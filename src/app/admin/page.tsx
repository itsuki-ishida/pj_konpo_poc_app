"use client"

import * as React from "react"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import type { Order, Product, OrderImage } from "@/types/database"
import {
  Download,
  Loader2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

interface OrderWithDetails extends Order {
  products: Product[]
  images: OrderImage[]
}

interface ExportRow {
  注文番号: string
  商品コードリスト: string
  商品名リスト: string
  数量リスト: string
  総数量: number
  充填率: string
  箱実績: string
  箱予想: string
  記入者: string
  PoC梱包サイズ: string
  メモ: string
  [key: string]: string | number // For dynamic image columns
}

const PAGE_SIZE = 20

export default function AdminPage() {
  const { toast } = useToast()
  const [selectedDataset, setSelectedDataset] = React.useState<string>("")
  const [orders, setOrders] = React.useState<OrderWithDetails[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [totalCount, setTotalCount] = React.useState(0)

  // Load selected dataset from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem("selectedDataset")
    if (saved) {
      setSelectedDataset(saved)
    }

    const handleDatasetChange = (e: CustomEvent) => {
      setSelectedDataset(e.detail)
      setOrders([])
      setCurrentPage(1)
    }

    window.addEventListener("datasetChanged", handleDatasetChange as EventListener)
    return () => {
      window.removeEventListener("datasetChanged", handleDatasetChange as EventListener)
    }
  }, [])

  // Fetch orders when dataset changes
  React.useEffect(() => {
    if (selectedDataset) {
      fetchOrders()
    }
  }, [selectedDataset, currentPage])

  const fetchOrders = async () => {
    if (!selectedDataset) return

    setIsLoading(true)
    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("dataset_id", selectedDataset)

      if (countError) throw countError
      setTotalCount(count || 0)

      // Fetch orders with pagination
      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          products (*),
          images (*)
        `)
        .eq("dataset_id", selectedDataset)
        .order("order_number", { ascending: true })
        .range(from, to)

      if (error) throw error
      setOrders(data as OrderWithDetails[])
    } catch (error) {
      console.error("Fetch error:", error)
      toast({
        title: "読み込みエラー",
        description: "データの取得に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportExcel = async () => {
    if (!selectedDataset) return

    setIsExporting(true)
    try {
      // Fetch all orders for export
      const { data: allOrders, error } = await supabase
        .from("orders")
        .select(`
          *,
          products (*),
          images (*)
        `)
        .eq("dataset_id", selectedDataset)
        .order("order_number", { ascending: true })

      if (error) throw error

      // Find max number of images by type
      let maxActualImages = 0
      let maxPredictedImages = 0
      const typedOrders = allOrders as OrderWithDetails[]
      typedOrders?.forEach((order) => {
        const actualCount = order.images?.filter(img => img.image_type === 'actual').length || 0
        const predictedCount = order.images?.filter(img => img.image_type === 'predicted').length || 0
        if (actualCount > maxActualImages) maxActualImages = actualCount
        if (predictedCount > maxPredictedImages) maxPredictedImages = predictedCount
      })

      // Transform data for export
      const exportData: ExportRow[] = typedOrders.map(
        (order) => {
          const actualImages = order.images?.filter(img => img.image_type === 'actual') || []
          const predictedImages = order.images?.filter(img => img.image_type === 'predicted') || []

          const row: ExportRow = {
            注文番号: order.order_number,
            商品コードリスト: order.products
              .map((p) => p.product_code)
              .join(", "),
            商品名リスト: order.products.map((p) => p.product_name).join(", "),
            数量リスト: order.products.map((p) => p.quantity).join(", "),
            総数量: order.total_quantity,
            充填率: (order.fill_rate * 100).toFixed(2) + "%",
            箱実績: order.actual_size,
            箱予想: order.predicted_size,
            記入者: order.recorder || "",
            PoC梱包サイズ: order.poc_packing_size || "",
            メモ: order.memo || "",
          }

          // Add actual box image URLs
          for (let i = 0; i < maxActualImages; i++) {
            row[`実績箱画像${i + 1}`] = actualImages[i]?.url || ""
          }

          // Add predicted box image URLs
          for (let i = 0; i < maxPredictedImages; i++) {
            row[`予測箱画像${i + 1}`] = predictedImages[i]?.url || ""
          }

          return row
        }
      )

      // Create workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // Adjust column widths
      const colWidths = [
        { wch: 12 }, // 注文番号
        { wch: 20 }, // 商品コードリスト
        { wch: 40 }, // 商品名リスト
        { wch: 15 }, // 数量リスト
        { wch: 8 }, // 総数量
        { wch: 10 }, // 充填率
        { wch: 12 }, // 箱実績
        { wch: 12 }, // 箱予想
        { wch: 12 }, // 記入者
        { wch: 15 }, // PoC梱包サイズ
        { wch: 30 }, // メモ
      ]
      // Add actual box image column widths
      for (let i = 0; i < maxActualImages; i++) {
        colWidths.push({ wch: 50 })
      }
      // Add predicted box image column widths
      for (let i = 0; i < maxPredictedImages; i++) {
        colWidths.push({ wch: 50 })
      }
      ws["!cols"] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, "検証データ")

      // Generate filename with date
      const date = new Date().toISOString().split("T")[0]
      const filename = `検証データ_${date}.xlsx`

      // Download
      XLSX.writeFile(wb, filename)

      toast({
        title: "エクスポート完了",
        description: `${filename}をダウンロードしました`,
        variant: "success",
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "エクスポートエラー",
        description: "Excelファイルの作成に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const filteredOrders = React.useMemo(() => {
    if (!searchQuery) return orders
    const query = searchQuery.toLowerCase()
    return orders.filter(
      (order) =>
        order.order_number.toLowerCase().includes(query) ||
        order.products.some(
          (p) =>
            p.product_code.toLowerCase().includes(query) ||
            p.product_name.toLowerCase().includes(query)
        )
    )
  }, [orders, searchQuery])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl pt-16 md:pt-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">管理者画面</h1>
        <p className="text-muted-foreground mt-1">
          登録されたデータの閲覧・エクスポート
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="注文番号・商品コード・商品名で検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchOrders}
                disabled={isLoading || !selectedDataset}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                更新
              </Button>
              <Button
                onClick={handleExportExcel}
                disabled={isExporting || !selectedDataset || orders.length === 0}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Excel出力
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">データ一覧</CardTitle>
          <CardDescription>
            {totalCount}件中 {(currentPage - 1) * PAGE_SIZE + 1} -{" "}
            {Math.min(currentPage * PAGE_SIZE, totalCount)}件を表示
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedDataset ? (
            <p className="text-center py-8 text-muted-foreground">
              サイドバーからデータセットを選択してください
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              データがありません
            </p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left whitespace-nowrap sticky left-0 bg-muted">
                        注文番号
                      </th>
                      <th className="p-3 text-left whitespace-nowrap">商品</th>
                      <th className="p-3 text-left whitespace-nowrap">総数量</th>
                      <th className="p-3 text-left whitespace-nowrap">充填率</th>
                      <th className="p-3 text-left whitespace-nowrap">箱実績</th>
                      <th className="p-3 text-left whitespace-nowrap">箱予想</th>
                      <th className="p-3 text-left whitespace-nowrap">記入者</th>
                      <th className="p-3 text-left whitespace-nowrap">
                        PoC梱包
                      </th>
                      <th className="p-3 text-left whitespace-nowrap">メモ</th>
                      <th className="p-3 text-left whitespace-nowrap">実績箱画像</th>
                      <th className="p-3 text-left whitespace-nowrap">予測箱画像</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-t hover:bg-muted/50">
                        <td className="p-3 whitespace-nowrap font-mono sticky left-0 bg-background">
                          {order.order_number}
                        </td>
                        <td className="p-3">
                          <div className="max-w-[200px]">
                            {order.products.slice(0, 2).map((p, i) => (
                              <div
                                key={p.id}
                                className="text-xs truncate text-muted-foreground"
                              >
                                {p.product_code}: {p.product_name} x{p.quantity}
                              </div>
                            ))}
                            {order.products.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                ...他{order.products.length - 2}件
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {order.total_quantity}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {(order.fill_rate * 100).toFixed(1)}%
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {order.actual_size}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {order.predicted_size}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {order.recorder || "-"}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={
                              order.poc_packing_size
                                ? "text-green-600 font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {order.poc_packing_size || "-"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="max-w-[150px] truncate">
                            {order.memo || "-"}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {order.images.filter(img => img.image_type === 'actual').length > 0 ? (
                            <div className="flex items-center gap-1">
                              {order.images.filter(img => img.image_type === 'actual').map((image, index) => (
                                <a
                                  key={image.id}
                                  href={image.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200"
                                >
                                  {index + 1}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {order.images.filter(img => img.image_type === 'predicted').length > 0 ? (
                            <div className="flex items-center gap-1">
                              {order.images.filter(img => img.image_type === 'predicted').map((image, index) => (
                                <a
                                  key={image.id}
                                  href={image.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200"
                                >
                                  {index + 1}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
