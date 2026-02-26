"use client"

import * as React from "react"
import Papa from "papaparse"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

interface CSVRow {
  注文番号: string
  商品コード: string
  商品名: string
  カテゴリ: string
  数量: string
  種別: string
  "適用サイズ_実績": string
  "適用サイズ_予測": string
  総数量: string
  充填率: string
  lx: string
  ly: string
  lz: string
}

export default function DataRegistrationPage() {
  const { toast } = useToast()
  const [datasetName, setDatasetName] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [preview, setPreview] = React.useState<CSVRow[]>([])
  const [uploadStatus, setUploadStatus] = React.useState<{
    total: number
    processed: number
    errors: string[]
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      parseCSVPreview(selectedFile)
    }
  }

  const parseCSVPreview = (file: File) => {
    Papa.parse(file, {
      header: true,
      encoding: "UTF-8",
      preview: 5,
      complete: (results) => {
        setPreview(results.data as CSVRow[])
      },
      error: (error) => {
        console.error("CSV parse error:", error)
        toast({
          title: "CSVの読み込みエラー",
          description: "ファイルの形式を確認してください",
          variant: "destructive",
        })
      },
    })
  }

  const handleUpload = async () => {
    if (!file || !datasetName.trim()) {
      toast({
        title: "入力エラー",
        description: "データセット名とCSVファイルを選択してください",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadStatus({ total: 0, processed: 0, errors: [] })

    try {
      // Create dataset
      const { data: dataset, error: datasetError } = await supabase
        .from("datasets")
        .insert({ name: datasetName.trim() })
        .select()
        .single()

      if (datasetError) throw datasetError

      // Parse full CSV
      Papa.parse(file, {
        header: true,
        encoding: "UTF-8",
        complete: async (results) => {
          const rows = results.data as CSVRow[]
          const validRows = rows.filter((row) => row.注文番号)

          setUploadStatus((prev) => ({
            ...prev!,
            total: validRows.length,
          }))

          // Group rows by order number
          const orderGroups = new Map<string, CSVRow[]>()
          validRows.forEach((row) => {
            const orderNumber = row.注文番号
            if (!orderGroups.has(orderNumber)) {
              orderGroups.set(orderNumber, [])
            }
            orderGroups.get(orderNumber)!.push(row)
          })

          const errors: string[] = []
          let processed = 0

          for (const [orderNumber, orderRows] of orderGroups) {
            try {
              const firstRow = orderRows[0]

              // Insert order
              const { data: order, error: orderError } = await supabase
                .from("orders")
                .insert({
                  dataset_id: dataset.id,
                  order_number: orderNumber,
                  total_quantity: parseInt(firstRow.総数量) || 0,
                  actual_size: firstRow["適用サイズ_実績"] || "",
                  predicted_size: firstRow["適用サイズ_予測"] || "",
                  fill_rate: parseFloat(firstRow.充填率) || 0,
                  type: firstRow.種別 || "",
                })
                .select()
                .single()

              if (orderError) throw orderError

              // Insert products
              const products = orderRows.map((row) => ({
                order_id: order.id,
                product_code: row.商品コード || "",
                product_name: row.商品名 || "",
                category: row.カテゴリ || null,
                quantity: parseInt(row.数量) || 0,
                lx: parseInt(row.lx) || 0,
                ly: parseInt(row.ly) || 0,
                lz: parseInt(row.lz) || 0,
              }))

              const { error: productsError } = await supabase
                .from("products")
                .insert(products)

              if (productsError) throw productsError

              processed += orderRows.length
              setUploadStatus((prev) => ({
                ...prev!,
                processed,
              }))
            } catch (error) {
              console.error(`Error processing order ${orderNumber}:`, error)
              errors.push(`注文番号 ${orderNumber}: 登録エラー`)
            }
          }

          setUploadStatus((prev) => ({
            ...prev!,
            errors,
          }))

          if (errors.length === 0) {
            toast({
              title: "登録完了",
              description: `${orderGroups.size}件の注文データを登録しました`,
              variant: "success",
            })
            // Reset form
            setDatasetName("")
            setFile(null)
            setPreview([])
            // Reload datasets in sidebar
            window.dispatchEvent(new CustomEvent("datasetCreated"))
            // Refresh the page to update the sidebar
            window.location.reload()
          } else {
            toast({
              title: "一部エラー",
              description: `${errors.length}件のエラーが発生しました`,
              variant: "destructive",
            })
          }

          setIsUploading(false)
        },
        error: (error) => {
          console.error("CSV parse error:", error)
          toast({
            title: "CSVの読み込みエラー",
            description: "ファイルの形式を確認してください",
            variant: "destructive",
          })
          setIsUploading(false)
        },
      })
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "アップロードエラー",
        description: "データの登録に失敗しました",
        variant: "destructive",
      })
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl pt-16 md:pt-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">検証データ登録</h1>
        <p className="text-muted-foreground mt-1">
          CSVファイルをアップロードして検証データを登録します
        </p>
      </div>

      <div className="space-y-6">
        {/* Dataset name input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">データセット名</CardTitle>
            <CardDescription>
              登録するデータセットの名前を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="例: 2024年1月検証データ"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              disabled={isUploading}
            />
          </CardContent>
        </Card>

        {/* File upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CSVファイル</CardTitle>
            <CardDescription>
              検証データのCSVファイルを選択してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-primary transition-colors">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-2" />
              <Label
                htmlFor="csv-file"
                className="cursor-pointer text-center"
              >
                <span className="text-primary font-medium">
                  クリックしてファイルを選択
                </span>
                <br />
                <span className="text-sm text-muted-foreground">
                  または、ドラッグ&ドロップ
                </span>
              </Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {file && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>

            {/* CSV Preview */}
            {preview.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm">プレビュー (先頭5行)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border rounded-lg">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left whitespace-nowrap">注文番号</th>
                        <th className="p-2 text-left whitespace-nowrap">商品コード</th>
                        <th className="p-2 text-left whitespace-nowrap">商品名</th>
                        <th className="p-2 text-left whitespace-nowrap">カテゴリ</th>
                        <th className="p-2 text-left whitespace-nowrap">数量</th>
                        <th className="p-2 text-left whitespace-nowrap">種別</th>
                        <th className="p-2 text-left whitespace-nowrap">実績</th>
                        <th className="p-2 text-left whitespace-nowrap">予測</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 whitespace-nowrap">{row.注文番号}</td>
                          <td className="p-2 whitespace-nowrap">{row.商品コード}</td>
                          <td className="p-2 whitespace-nowrap max-w-[150px] truncate">
                            {row.商品名}
                          </td>
                          <td className="p-2 whitespace-nowrap">{row.カテゴリ}</td>
                          <td className="p-2 whitespace-nowrap">{row.数量}</td>
                          <td className="p-2 whitespace-nowrap">{row.種別}</td>
                          <td className="p-2 whitespace-nowrap">{row["適用サイズ_実績"]}</td>
                          <td className="p-2 whitespace-nowrap">{row["適用サイズ_予測"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload progress */}
        {uploadStatus && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>進捗</span>
                  <span>
                    {uploadStatus.processed} / {uploadStatus.total}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        uploadStatus.total > 0
                          ? (uploadStatus.processed / uploadStatus.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                {uploadStatus.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-2">
                      <AlertCircle className="h-4 w-4" />
                      エラー ({uploadStatus.errors.length}件)
                    </div>
                    <ul className="text-xs space-y-1">
                      {uploadStatus.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {uploadStatus.errors.length > 5 && (
                        <li>...他 {uploadStatus.errors.length - 5}件</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload button */}
        <Button
          onClick={handleUpload}
          disabled={!file || !datasetName.trim() || isUploading}
          className="w-full"
          size="lg"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              アップロード中...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              データを登録
            </>
          )}
        </Button>

        {/* CSV Format guide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CSVファイルの形式</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              以下のヘッダーを含むCSVファイルをアップロードしてください：
            </p>
            <div className="bg-muted p-3 rounded-lg overflow-x-auto">
              <code className="text-xs whitespace-nowrap">
                注文番号,商品コード,商品名,カテゴリ,数量,種別,適用サイズ_実績,適用サイズ_予測,総数量,充填率,lx,ly,lz
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
