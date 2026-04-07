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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react"
import {
  FORMAT_LABELS,
  FORMAT_V1_HEADERS,
  FORMAT_V2_HEADERS,
  type FormatV1Row,
  type FormatV2Row,
} from "@/lib/formats"
import type { FormatVersion } from "@/types/database"

export default function DataRegistrationPage() {
  const { toast } = useToast()
  const [formatVersion, setFormatVersion] = React.useState<FormatVersion>("v1")
  const [datasetName, setDatasetName] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [previewV1, setPreviewV1] = React.useState<FormatV1Row[]>([])
  const [previewV2, setPreviewV2] = React.useState<FormatV2Row[]>([])
  const [uploadStatus, setUploadStatus] = React.useState<{
    total: number
    processed: number
    errors: string[]
  } | null>(null)

  const resetPreview = () => {
    setPreviewV1([])
    setPreviewV2([])
  }

  const handleFormatChange = (value: string) => {
    setFormatVersion(value as FormatVersion)
    // フォーマット切替時はファイルとプレビューをリセット
    setFile(null)
    resetPreview()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      parseCSVPreview(selectedFile)
    }
  }

  const parseCSVPreview = (targetFile: File) => {
    Papa.parse(targetFile, {
      header: true,
      encoding: "UTF-8",
      preview: 5,
      complete: (results) => {
        if (formatVersion === "v1") {
          setPreviewV1(results.data as FormatV1Row[])
          setPreviewV2([])
        } else {
          setPreviewV2(results.data as FormatV2Row[])
          setPreviewV1([])
        }
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
      // Create dataset (with format_version)
      const { data: dataset, error: datasetError } = await supabase
        .from("datasets")
        .insert({ name: datasetName.trim(), format_version: formatVersion })
        .select()
        .single()

      if (datasetError) throw datasetError

      if (formatVersion === "v1") {
        await uploadV1(dataset.id)
      } else {
        await uploadV2(dataset.id)
      }
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

  // ===========================================================================
  // v1 アップロード処理
  // ===========================================================================
  const uploadV1 = async (datasetId: string) => {
    if (!file) return

    Papa.parse(file, {
      header: true,
      encoding: "UTF-8",
      complete: async (results) => {
        const rows = results.data as FormatV1Row[]
        const validRows = rows.filter((row) => row.注文番号)

        setUploadStatus((prev) => ({
          ...prev!,
          total: validRows.length,
        }))

        const orderGroups = new Map<string, FormatV1Row[]>()
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

            const { data: order, error: orderError } = await supabase
              .from("orders")
              .insert({
                dataset_id: datasetId,
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
            setUploadStatus((prev) => ({ ...prev!, processed }))
          } catch (error) {
            console.error(`Error processing order ${orderNumber}:`, error)
            errors.push(`注文番号 ${orderNumber}: 登録エラー`)
          }
        }

        finishUpload(orderGroups.size, errors)
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
  }

  // ===========================================================================
  // v2 アップロード処理
  // ===========================================================================
  const uploadV2 = async (datasetId: string) => {
    if (!file) return

    Papa.parse(file, {
      header: true,
      encoding: "UTF-8",
      complete: async (results) => {
        const rows = results.data as FormatV2Row[]
        const validRows = rows.filter((row) => row.注文番号)

        setUploadStatus((prev) => ({ ...prev!, total: validRows.length }))

        const orderGroups = new Map<string, FormatV2Row[]>()
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

            // 同一注文番号で備考が複数行ある場合は最初の非空値を採用
            const remarks =
              orderRows
                .map((r) => (r.備考 || "").trim())
                .find((v) => v.length > 0) || null

            const { data: order, error: orderError } = await supabase
              .from("orders_v2")
              .insert({
                dataset_id: datasetId,
                order_number: orderNumber,
                actual_size: firstRow.箱実績 || "",
                predicted_size_glpk: firstRow["箱予想（GLPK）"] || "",
                predicted_size_ga: firstRow["箱予想（GA）"] || "",
                predicted_size_ml: firstRow["箱予想（機械学習）"] || "",
                predicted_size_final: firstRow["箱予想（最終）"] || "",
                remarks,
              })
              .select()
              .single()

            if (orderError) throw orderError

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
              .from("products_v2")
              .insert(products)

            if (productsError) throw productsError

            processed += orderRows.length
            setUploadStatus((prev) => ({ ...prev!, processed }))
          } catch (error) {
            console.error(`Error processing order ${orderNumber}:`, error)
            errors.push(`注文番号 ${orderNumber}: 登録エラー`)
          }
        }

        finishUpload(orderGroups.size, errors)
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
  }

  const finishUpload = (orderCount: number, errors: string[]) => {
    setUploadStatus((prev) => ({ ...prev!, errors }))

    if (errors.length === 0) {
      toast({
        title: "登録完了",
        description: `${orderCount}件の注文データを登録しました`,
        variant: "success",
      })
      // Reset form
      setDatasetName("")
      setFile(null)
      resetPreview()
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
        {/* Format selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CSVフォーマット</CardTitle>
            <CardDescription>
              アップロードするCSVのフォーマットを選択してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={formatVersion}
              onValueChange={handleFormatChange}
              disabled={isUploading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1">{FORMAT_LABELS.v1}</SelectItem>
                <SelectItem value="v2">{FORMAT_LABELS.v2}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

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
              <Label htmlFor="csv-file" className="cursor-pointer text-center">
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

            {/* CSV Preview - v1 */}
            {formatVersion === "v1" && previewV1.length > 0 && (
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
                      {previewV1.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 whitespace-nowrap">{row.注文番号}</td>
                          <td className="p-2 whitespace-nowrap">{row.商品コード}</td>
                          <td className="p-2 whitespace-nowrap max-w-[150px] truncate">
                            {row.商品名}
                          </td>
                          <td className="p-2 whitespace-nowrap">{row.カテゴリ}</td>
                          <td className="p-2 whitespace-nowrap">{row.数量}</td>
                          <td className="p-2 whitespace-nowrap">{row.種別}</td>
                          <td className="p-2 whitespace-nowrap">
                            {row["適用サイズ_実績"]}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {row["適用サイズ_予測"]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CSV Preview - v2 */}
            {formatVersion === "v2" && previewV2.length > 0 && (
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
                        <th className="p-2 text-left whitespace-nowrap">箱実績</th>
                        <th className="p-2 text-left whitespace-nowrap">GLPK</th>
                        <th className="p-2 text-left whitespace-nowrap">GA</th>
                        <th className="p-2 text-left whitespace-nowrap">機械学習</th>
                        <th className="p-2 text-left whitespace-nowrap">最終</th>
                        <th className="p-2 text-left whitespace-nowrap">備考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewV2.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 whitespace-nowrap">{row.注文番号}</td>
                          <td className="p-2 whitespace-nowrap">{row.商品コード}</td>
                          <td className="p-2 whitespace-nowrap max-w-[150px] truncate">
                            {row.商品名}
                          </td>
                          <td className="p-2 whitespace-nowrap">{row.カテゴリ}</td>
                          <td className="p-2 whitespace-nowrap">{row.数量}</td>
                          <td className="p-2 whitespace-nowrap">{row.箱実績}</td>
                          <td className="p-2 whitespace-nowrap">
                            {row["箱予想（GLPK）"]}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {row["箱予想（GA）"]}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {row["箱予想（機械学習）"]}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {row["箱予想（最終）"]}
                          </td>
                          <td className="p-2 whitespace-nowrap max-w-[150px] truncate">
                            {row.備考}
                          </td>
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
            <CardDescription>{FORMAT_LABELS[formatVersion]}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              以下のヘッダーを含むCSVファイルをアップロードしてください：
            </p>
            <div className="bg-muted p-3 rounded-lg overflow-x-auto">
              <code className="text-xs whitespace-nowrap">
                {(formatVersion === "v1"
                  ? FORMAT_V1_HEADERS
                  : FORMAT_V2_HEADERS
                ).join(",")}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
