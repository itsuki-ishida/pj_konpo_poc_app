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
import type {
  Order,
  Product,
  OrderImage,
  OrderV2,
  ProductV2,
  OrderImageV2,
  FormatVersion,
  ImageTypeV2,
} from "@/types/database"
import {
  Download,
  Loader2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  IMAGE_TYPE_V2_ORDER,
  IMAGE_TYPE_V2_SHORT_LABELS,
} from "@/lib/formats"

interface OrderV1WithDetails extends Order {
  products: Product[]
  images: OrderImage[]
}

interface OrderV2WithDetails extends OrderV2 {
  products: ProductV2[]
  images: OrderImageV2[]
}

interface ExportRowV1 {
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
  [key: string]: string | number
}

interface ExportRowV2 {
  注文番号: string
  商品コードリスト: string
  商品名リスト: string
  カテゴリリスト: string
  数量リスト: string
  箱実績: string
  "箱予想（GLPK）": string
  "箱予想（GA）": string
  "箱予想（機械学習）": string
  "箱予想（最終）": string
  備考: string
  記入者: string
  PoC梱包サイズ: string
  メモ: string
  [key: string]: string | number
}

const PAGE_SIZE = 20

export default function AdminPage() {
  const { toast } = useToast()
  const [selectedDataset, setSelectedDataset] = React.useState<string>("")
  const [formatVersion, setFormatVersion] =
    React.useState<FormatVersion>("v1")
  const [ordersV1, setOrdersV1] = React.useState<OrderV1WithDetails[]>([])
  const [ordersV2, setOrdersV2] = React.useState<OrderV2WithDetails[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [totalCount, setTotalCount] = React.useState(0)

  // Load selected dataset/format from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem("selectedDataset")
    if (saved) setSelectedDataset(saved)
    const savedFormat = localStorage.getItem("selectedDatasetFormat")
    if (savedFormat === "v1" || savedFormat === "v2") {
      setFormatVersion(savedFormat)
    }

    const handleDatasetChange = (e: CustomEvent) => {
      const detail = e.detail as { id: string; formatVersion: FormatVersion }
      setSelectedDataset(detail.id)
      setFormatVersion(detail.formatVersion || "v1")
      setOrdersV1([])
      setOrdersV2([])
      setCurrentPage(1)
    }

    window.addEventListener(
      "datasetChanged",
      handleDatasetChange as EventListener
    )
    return () => {
      window.removeEventListener(
        "datasetChanged",
        handleDatasetChange as EventListener
      )
    }
  }, [])

  // Fetch orders when dataset changes
  React.useEffect(() => {
    if (selectedDataset) {
      fetchOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDataset, currentPage, formatVersion])

  const fetchOrders = async () => {
    if (!selectedDataset) return

    setIsLoading(true)
    try {
      const table = formatVersion === "v1" ? "orders" : "orders_v2"

      // Get total count
      const { count, error: countError } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("dataset_id", selectedDataset)

      if (countError) throw countError
      setTotalCount(count || 0)

      // Fetch with pagination
      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      if (formatVersion === "v1") {
        const { data, error } = await supabase
          .from("orders")
          .select(`*, products (*), images (*)`)
          .eq("dataset_id", selectedDataset)
          .order("order_number", { ascending: true })
          .range(from, to)

        if (error) throw error
        setOrdersV1((data as OrderV1WithDetails[]) || [])
        setOrdersV2([])
      } else {
        const { data, error } = await supabase
          .from("orders_v2")
          .select(`*, products:products_v2 (*), images:images_v2 (*)`)
          .eq("dataset_id", selectedDataset)
          .order("order_number", { ascending: true })
          .range(from, to)

        if (error) throw error
        setOrdersV2((data as OrderV2WithDetails[]) || [])
        setOrdersV1([])
      }
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

  // ==========================================================================
  // Excel 出力（v1）
  // ==========================================================================
  const exportExcelV1 = async () => {
    const { data: allOrders, error } = await supabase
      .from("orders")
      .select(`*, products (*), images (*)`)
      .eq("dataset_id", selectedDataset)
      .order("order_number", { ascending: true })

    if (error) throw error

    let maxActualImages = 0
    let maxPredictedImages = 0
    const typedOrders = allOrders as OrderV1WithDetails[]
    typedOrders?.forEach((order) => {
      const actualCount =
        order.images?.filter((img) => img.image_type === "actual").length || 0
      const predictedCount =
        order.images?.filter((img) => img.image_type === "predicted").length ||
        0
      if (actualCount > maxActualImages) maxActualImages = actualCount
      if (predictedCount > maxPredictedImages)
        maxPredictedImages = predictedCount
    })

    const exportData: ExportRowV1[] = typedOrders.map((order) => {
      const actualImages =
        order.images?.filter((img) => img.image_type === "actual") || []
      const predictedImages =
        order.images?.filter((img) => img.image_type === "predicted") || []

      const row: ExportRowV1 = {
        注文番号: order.order_number,
        商品コードリスト: order.products.map((p) => p.product_code).join(", "),
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

      for (let i = 0; i < maxActualImages; i++) {
        row[`実績箱画像${i + 1}`] = actualImages[i]?.url || ""
      }
      for (let i = 0; i < maxPredictedImages; i++) {
        row[`予測箱画像${i + 1}`] = predictedImages[i]?.url || ""
      }

      return row
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    const colWidths = [
      { wch: 12 },
      { wch: 20 },
      { wch: 40 },
      { wch: 15 },
      { wch: 8 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 30 },
    ]
    for (let i = 0; i < maxActualImages; i++) colWidths.push({ wch: 50 })
    for (let i = 0; i < maxPredictedImages; i++) colWidths.push({ wch: 50 })
    ws["!cols"] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, "検証データ")

    const date = new Date().toISOString().split("T")[0]
    const filename = `検証データ_v1_${date}.xlsx`

    XLSX.writeFile(wb, filename)

    toast({
      title: "エクスポート完了",
      description: `${filename}をダウンロードしました`,
      variant: "success",
    })
  }

  // ==========================================================================
  // Excel 出力（v2）
  // ==========================================================================
  const exportExcelV2 = async () => {
    const { data: allOrders, error } = await supabase
      .from("orders_v2")
      .select(`*, products:products_v2 (*), images:images_v2 (*)`)
      .eq("dataset_id", selectedDataset)
      .order("order_number", { ascending: true })

    if (error) throw error

    const typedOrders = allOrders as OrderV2WithDetails[]

    // 各画像種別ごとの最大数
    const maxImagesByType: Record<ImageTypeV2, number> = {
      actual: 0,
      glpk: 0,
      ga: 0,
      ml: 0,
      final: 0,
    }
    typedOrders?.forEach((order) => {
      IMAGE_TYPE_V2_ORDER.forEach((type) => {
        const count =
          order.images?.filter((img) => img.image_type === type).length || 0
        if (count > maxImagesByType[type]) maxImagesByType[type] = count
      })
    })

    const exportData: ExportRowV2[] = typedOrders.map((order) => {
      const row: ExportRowV2 = {
        注文番号: order.order_number,
        商品コードリスト: order.products
          .map((p) => p.product_code)
          .join(", "),
        商品名リスト: order.products.map((p) => p.product_name).join(", "),
        カテゴリリスト: order.products
          .map((p) => p.category || "")
          .join(", "),
        数量リスト: order.products.map((p) => p.quantity).join(", "),
        箱実績: order.actual_size,
        "箱予想（GLPK）": order.predicted_size_glpk,
        "箱予想（GA）": order.predicted_size_ga,
        "箱予想（機械学習）": order.predicted_size_ml,
        "箱予想（最終）": order.predicted_size_final,
        備考: order.remarks || "",
        記入者: order.recorder || "",
        PoC梱包サイズ: order.poc_packing_size || "",
        メモ: order.memo || "",
      }

      IMAGE_TYPE_V2_ORDER.forEach((type) => {
        const images =
          order.images?.filter((img) => img.image_type === type) || []
        const label = IMAGE_TYPE_V2_SHORT_LABELS[type]
        for (let i = 0; i < maxImagesByType[type]; i++) {
          row[`画像_${label}_${i + 1}`] = images[i]?.url || ""
        }
      })

      return row
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    const baseColWidths = [
      { wch: 12 }, // 注文番号
      { wch: 20 }, // 商品コードリスト
      { wch: 40 }, // 商品名リスト
      { wch: 20 }, // カテゴリリスト
      { wch: 15 }, // 数量リスト
      { wch: 12 }, // 箱実績
      { wch: 14 }, // GLPK
      { wch: 14 }, // GA
      { wch: 14 }, // 機械学習
      { wch: 14 }, // 最終
      { wch: 30 }, // 備考
      { wch: 12 }, // 記入者
      { wch: 15 }, // PoC梱包サイズ
      { wch: 30 }, // メモ
    ]
    IMAGE_TYPE_V2_ORDER.forEach((type) => {
      for (let _i = 0; _i < maxImagesByType[type]; _i += 1) {
        baseColWidths.push({ wch: 50 })
      }
    })
    ws["!cols"] = baseColWidths

    XLSX.utils.book_append_sheet(wb, ws, "検証データ")

    const date = new Date().toISOString().split("T")[0]
    const filename = `検証データ_v2_${date}.xlsx`

    XLSX.writeFile(wb, filename)

    toast({
      title: "エクスポート完了",
      description: `${filename}をダウンロードしました`,
      variant: "success",
    })
  }

  const handleExportExcel = async () => {
    if (!selectedDataset) return

    setIsExporting(true)
    try {
      if (formatVersion === "v1") {
        await exportExcelV1()
      } else {
        await exportExcelV2()
      }
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

  // ==========================================================================
  // 検索フィルタ
  // ==========================================================================
  const filteredOrdersV1 = React.useMemo(() => {
    if (!searchQuery) return ordersV1
    const query = searchQuery.toLowerCase()
    return ordersV1.filter(
      (order) =>
        order.order_number.toLowerCase().includes(query) ||
        order.products.some(
          (p) =>
            p.product_code.toLowerCase().includes(query) ||
            p.product_name.toLowerCase().includes(query)
        )
    )
  }, [ordersV1, searchQuery])

  const filteredOrdersV2 = React.useMemo(() => {
    if (!searchQuery) return ordersV2
    const query = searchQuery.toLowerCase()
    return ordersV2.filter(
      (order) =>
        order.order_number.toLowerCase().includes(query) ||
        order.products.some(
          (p) =>
            p.product_code.toLowerCase().includes(query) ||
            p.product_name.toLowerCase().includes(query)
        )
    )
  }, [ordersV2, searchQuery])

  const ordersLength =
    formatVersion === "v1" ? ordersV1.length : ordersV2.length

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
                disabled={
                  isExporting || !selectedDataset || ordersLength === 0
                }
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
          ) : ordersLength === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              データがありません
            </p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-6">
                {formatVersion === "v1" ? (
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
                        <th className="p-3 text-left whitespace-nowrap">
                          実績箱画像
                        </th>
                        <th className="p-3 text-left whitespace-nowrap">
                          予測箱画像
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrdersV1.map((order) => (
                        <tr key={order.id} className="border-t hover:bg-muted/50">
                          <td className="p-3 whitespace-nowrap font-mono sticky left-0 bg-background">
                            {order.order_number}
                          </td>
                          <td className="p-3">
                            <div className="max-w-[200px]">
                              {order.products.slice(0, 2).map((p) => (
                                <div
                                  key={p.id}
                                  className="text-xs truncate text-muted-foreground"
                                >
                                  {p.product_code}: {p.product_name} x
                                  {p.quantity}
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
                            {order.images.filter(
                              (img) => img.image_type === "actual"
                            ).length > 0 ? (
                              <div className="flex items-center gap-1">
                                {order.images
                                  .filter((img) => img.image_type === "actual")
                                  .map((image, index) => (
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
                            {order.images.filter(
                              (img) => img.image_type === "predicted"
                            ).length > 0 ? (
                              <div className="flex items-center gap-1">
                                {order.images
                                  .filter(
                                    (img) => img.image_type === "predicted"
                                  )
                                  .map((image, index) => (
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
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left whitespace-nowrap sticky left-0 bg-muted">
                          注文番号
                        </th>
                        <th className="p-3 text-left whitespace-nowrap">商品</th>
                        <th className="p-3 text-left whitespace-nowrap">箱実績</th>
                        <th className="p-3 text-left whitespace-nowrap">GLPK</th>
                        <th className="p-3 text-left whitespace-nowrap">GA</th>
                        <th className="p-3 text-left whitespace-nowrap">
                          機械学習
                        </th>
                        <th className="p-3 text-left whitespace-nowrap">最終</th>
                        <th className="p-3 text-left whitespace-nowrap">備考</th>
                        <th className="p-3 text-left whitespace-nowrap">
                          記入者
                        </th>
                        <th className="p-3 text-left whitespace-nowrap">
                          PoC梱包
                        </th>
                        <th className="p-3 text-left whitespace-nowrap">メモ</th>
                        <th className="p-3 text-left whitespace-nowrap">画像</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrdersV2.map((order) => (
                        <tr
                          key={order.id}
                          className="border-t hover:bg-muted/50"
                        >
                          <td className="p-3 whitespace-nowrap font-mono sticky left-0 bg-background">
                            {order.order_number}
                          </td>
                          <td className="p-3">
                            <div className="max-w-[200px]">
                              {order.products.slice(0, 2).map((p) => (
                                <div
                                  key={p.id}
                                  className="text-xs truncate text-muted-foreground"
                                >
                                  {p.product_code}: {p.product_name} x
                                  {p.quantity}
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
                            {order.actual_size || "-"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {order.predicted_size_glpk || "-"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {order.predicted_size_ga || "-"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {order.predicted_size_ml || "-"}
                          </td>
                          <td className="p-3 whitespace-nowrap text-emerald-700 font-medium">
                            {order.predicted_size_final || "-"}
                          </td>
                          <td className="p-3">
                            <div className="max-w-[150px] truncate">
                              {order.remarks || "-"}
                            </div>
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
                            <div className="flex flex-col gap-1">
                              {IMAGE_TYPE_V2_ORDER.map((type) => {
                                const images = order.images.filter(
                                  (img) => img.image_type === type
                                )
                                if (images.length === 0) return null
                                return (
                                  <div
                                    key={type}
                                    className="flex items-center gap-1"
                                  >
                                    <span className="text-[10px] text-muted-foreground w-10">
                                      {IMAGE_TYPE_V2_SHORT_LABELS[type]}
                                    </span>
                                    {images.map((image, index) => (
                                      <a
                                        key={image.id}
                                        href={image.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded hover:bg-emerald-200"
                                      >
                                        {index + 1}
                                      </a>
                                    ))}
                                  </div>
                                )
                              })}
                              {order.images.length === 0 && (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
