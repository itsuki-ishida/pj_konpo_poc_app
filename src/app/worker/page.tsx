"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import type {
  Order,
  Product,
  OrderImage,
  OrderV2,
  ProductV2,
  OrderImageV2,
  FormatVersion,
  ImageTypeV1,
  ImageTypeV2,
} from "@/types/database"
import {
  Search,
  Camera,
  Save,
  Loader2,
  Package,
  Box,
  Ruler,
  Trash2,
  ImageIcon,
} from "lucide-react"
import { CameraCapture } from "@/components/camera-capture"
import {
  IMAGE_TYPE_V2_ORDER,
  IMAGE_TYPE_V2_LABELS,
} from "@/lib/formats"

const PACKING_SIZES = [
  "ネコポス大",
  "ネコポス小",
  "コンパクト",
  "60サイズ",
  "80サイズ",
  "100サイズ",
  "120サイズ",
]

interface OrderV1WithDetails extends Order {
  products: Product[]
  images: OrderImage[]
}

interface OrderV2WithDetails extends OrderV2 {
  products: ProductV2[]
  images: OrderImageV2[]
}

export default function WorkerPage() {
  const { toast } = useToast()
  const [selectedDataset, setSelectedDataset] = React.useState<string>("")
  const [formatVersion, setFormatVersion] =
    React.useState<FormatVersion>("v1")
  const [orderNumber, setOrderNumber] = React.useState("")
  const [orderV1, setOrderV1] = React.useState<OrderV1WithDetails | null>(null)
  const [orderV2, setOrderV2] = React.useState<OrderV2WithDetails | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [currentCameraTypeV1, setCurrentCameraTypeV1] =
    React.useState<ImageTypeV1 | null>(null)
  const [currentCameraTypeV2, setCurrentCameraTypeV2] =
    React.useState<ImageTypeV2 | null>(null)
  const [recorder, setRecorder] = React.useState<string>("")
  const [pocPackingSize, setPocPackingSize] = React.useState<string>("")
  const [memo, setMemo] = React.useState("")
  const [originalMemo, setOriginalMemo] = React.useState("")
  const [checkedProducts, setCheckedProducts] = React.useState<Set<string>>(
    new Set()
  )
  const [deleteImageId, setDeleteImageId] = React.useState<string | null>(null)
  const [hasUnsavedMemo, setHasUnsavedMemo] = React.useState(false)

  const resetOrderState = () => {
    setOrderV1(null)
    setOrderV2(null)
    setOrderNumber("")
    setRecorder("")
    setPocPackingSize("")
    setMemo("")
    setOriginalMemo("")
    setCheckedProducts(new Set())
  }

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
      resetOrderState()
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

  // Warn before leaving with unsaved memo
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedMemo) {
        e.preventDefault()
        e.returnValue = ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [hasUnsavedMemo])

  // Track memo changes
  React.useEffect(() => {
    setHasUnsavedMemo(memo !== originalMemo)
  }, [memo, originalMemo])

  const order = formatVersion === "v1" ? orderV1 : orderV2
  const orderId = order?.id ?? null

  // ==========================================================================
  // 注文検索
  // ==========================================================================
  const searchOrder = async () => {
    if (!selectedDataset || !orderNumber.trim()) {
      toast({
        title: "入力エラー",
        description: "注文番号を入力してください",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      if (formatVersion === "v1") {
        const { data, error } = await supabase
          .from("orders")
          .select(`*, products (*), images (*)`)
          .eq("dataset_id", selectedDataset)
          .eq("order_number", orderNumber.trim())
          .single()

        if (error) {
          if (error.code === "PGRST116") {
            toast({
              title: "注文が見つかりません",
              description: `注文番号「${orderNumber}」は存在しません`,
              variant: "destructive",
            })
          } else {
            throw error
          }
          setOrderV1(null)
          return
        }

        const v1 = data as OrderV1WithDetails
        setOrderV1(v1)
        setOrderV2(null)
        setRecorder(v1.recorder || "")
        setPocPackingSize(v1.poc_packing_size || "")
        setMemo(v1.memo || "")
        setOriginalMemo(v1.memo || "")

        const checked = new Set<string>()
        v1.products?.forEach((p) => {
          if (p.is_checked) checked.add(p.id)
        })
        setCheckedProducts(checked)
      } else {
        const { data, error } = await supabase
          .from("orders_v2")
          .select(`*, products:products_v2 (*), images:images_v2 (*)`)
          .eq("dataset_id", selectedDataset)
          .eq("order_number", orderNumber.trim())
          .single()

        if (error) {
          if (error.code === "PGRST116") {
            toast({
              title: "注文が見つかりません",
              description: `注文番号「${orderNumber}」は存在しません`,
              variant: "destructive",
            })
          } else {
            throw error
          }
          setOrderV2(null)
          return
        }

        const v2 = data as OrderV2WithDetails
        setOrderV2(v2)
        setOrderV1(null)
        setRecorder(v2.recorder || "")
        setPocPackingSize(v2.poc_packing_size || "")
        setMemo(v2.memo || "")
        setOriginalMemo(v2.memo || "")

        const checked = new Set<string>()
        v2.products?.forEach((p) => {
          if (p.is_checked) checked.add(p.id)
        })
        setCheckedProducts(checked)
      }
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "検索エラー",
        description: "注文の検索に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // ==========================================================================
  // 商品チェック
  // ==========================================================================
  const handleProductCheck = async (productId: string, checked: boolean) => {
    try {
      const table = formatVersion === "v1" ? "products" : "products_v2"
      const { error } = await supabase
        .from(table)
        .update({ is_checked: checked })
        .eq("id", productId)

      if (error) throw error

      setCheckedProducts((prev) => {
        const next = new Set(prev)
        if (checked) {
          next.add(productId)
        } else {
          next.delete(productId)
        }
        return next
      })
    } catch (error) {
      console.error("Check error:", error)
      toast({
        title: "エラー",
        description: "チェック状態の更新に失敗しました",
        variant: "destructive",
      })
    }
  }

  // ==========================================================================
  // 記入者保存
  // ==========================================================================
  const handleRecorderSave = async () => {
    if (!orderId) return

    try {
      const table = formatVersion === "v1" ? "orders" : "orders_v2"
      const { error } = await supabase
        .from(table)
        .update({ recorder })
        .eq("id", orderId)

      if (error) throw error

      if (formatVersion === "v1") {
        setOrderV1((prev) => (prev ? { ...prev, recorder } : null))
      } else {
        setOrderV2((prev) => (prev ? { ...prev, recorder } : null))
      }

      toast({
        title: "保存しました",
        description: "記入者を更新しました",
        variant: "success",
      })
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "保存エラー",
        description: "記入者の更新に失敗しました",
        variant: "destructive",
      })
    }
  }

  // ==========================================================================
  // PoC梱包サイズ
  // ==========================================================================
  const handlePackingSizeChange = async (value: string) => {
    if (!orderId) return

    try {
      const table = formatVersion === "v1" ? "orders" : "orders_v2"
      const { error } = await supabase
        .from(table)
        .update({ poc_packing_size: value })
        .eq("id", orderId)

      if (error) throw error

      setPocPackingSize(value)
      if (formatVersion === "v1") {
        setOrderV1((prev) =>
          prev ? { ...prev, poc_packing_size: value } : null
        )
      } else {
        setOrderV2((prev) =>
          prev ? { ...prev, poc_packing_size: value } : null
        )
      }

      toast({
        title: "保存しました",
        description: "PoC梱包サイズを更新しました",
        variant: "success",
      })
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "保存エラー",
        description: "PoC梱包サイズの更新に失敗しました",
        variant: "destructive",
      })
    }
  }

  // ==========================================================================
  // メモ
  // ==========================================================================
  const handleMemoSave = async () => {
    if (!orderId) return

    setIsSaving(true)
    try {
      const table = formatVersion === "v1" ? "orders" : "orders_v2"
      const { error } = await supabase
        .from(table)
        .update({ memo })
        .eq("id", orderId)

      if (error) throw error

      setOriginalMemo(memo)
      if (formatVersion === "v1") {
        setOrderV1((prev) => (prev ? { ...prev, memo } : null))
      } else {
        setOrderV2((prev) => (prev ? { ...prev, memo } : null))
      }

      toast({
        title: "保存しました",
        description: "メモを更新しました",
        variant: "success",
      })
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "保存エラー",
        description: "メモの更新に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // ==========================================================================
  // 画像アップロード
  // ==========================================================================
  const handleImageCapture = async (imageDataUrl: string) => {
    if (!orderId) return
    const cameraType =
      formatVersion === "v1" ? currentCameraTypeV1 : currentCameraTypeV2
    if (!cameraType) return

    try {
      const response = await fetch(imageDataUrl)
      const blob = await response.blob()

      const filename = `${order!.order_number}/${cameraType}_${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from("order-images")
        .upload(filename, blob, { contentType: "image/jpeg" })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from("order-images")
        .getPublicUrl(filename)

      const table = formatVersion === "v1" ? "images" : "images_v2"
      const { data: imageRecord, error: dbError } = await supabase
        .from(table)
        .insert({
          order_id: orderId,
          url: urlData.publicUrl,
          image_type: cameraType,
        })
        .select()
        .single()

      if (dbError) throw dbError

      if (formatVersion === "v1") {
        setOrderV1((prev) =>
          prev
            ? { ...prev, images: [...prev.images, imageRecord as OrderImage] }
            : null
        )
        setCurrentCameraTypeV1(null)
      } else {
        setOrderV2((prev) =>
          prev
            ? { ...prev, images: [...prev.images, imageRecord as OrderImageV2] }
            : null
        )
        setCurrentCameraTypeV2(null)
      }

      const label =
        formatVersion === "v1"
          ? cameraType === "actual"
            ? "実績箱"
            : "予測箱"
          : IMAGE_TYPE_V2_LABELS[cameraType as ImageTypeV2]

      toast({
        title: "保存しました",
        description: `${label}の画像をアップロードしました`,
        variant: "success",
      })
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "アップロードエラー",
        description: "画像の保存に失敗しました",
        variant: "destructive",
      })
    }
  }

  // ==========================================================================
  // 画像削除
  // ==========================================================================
  const handleImageDelete = async () => {
    if (!deleteImageId || !order) return

    try {
      const image = order.images.find((img) => img.id === deleteImageId)
      if (!image) return

      const urlParts = image.url.split("/")
      const filename = urlParts.slice(-2).join("/")

      await supabase.storage.from("order-images").remove([filename])

      const table = formatVersion === "v1" ? "images" : "images_v2"
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", deleteImageId)

      if (error) throw error

      if (formatVersion === "v1") {
        setOrderV1((prev) =>
          prev
            ? {
                ...prev,
                images: prev.images.filter((img) => img.id !== deleteImageId),
              }
            : null
        )
      } else {
        setOrderV2((prev) =>
          prev
            ? {
                ...prev,
                images: prev.images.filter((img) => img.id !== deleteImageId),
              }
            : null
        )
      }

      toast({
        title: "削除しました",
        description: "画像を削除しました",
        variant: "success",
      })
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "削除エラー",
        description: "画像の削除に失敗しました",
        variant: "destructive",
      })
    } finally {
      setDeleteImageId(null)
    }
  }

  // ==========================================================================
  // 描画ヘルパー
  // ==========================================================================
  const renderImagesSectionV1 = (type: ImageTypeV1, title: string) => {
    if (!orderV1) return null
    const images = orderV1.images.filter((img) => img.image_type === type)
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            写真（{title}）
          </CardTitle>
          <CardDescription>
            {title}での梱包状態の写真を撮影・保存できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={() => setCurrentCameraTypeV1(type)}
              variant="outline"
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              {title}を撮影
            </Button>

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((image) => (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.url}
                      alt={`${title}画像`}
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => setDeleteImageId(image.id)}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderImagesSectionV2 = (type: ImageTypeV2) => {
    if (!orderV2) return null
    const images = orderV2.images.filter((img) => img.image_type === type)
    const title = IMAGE_TYPE_V2_LABELS[type]
    return (
      <Card key={type}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            写真（{title}）
          </CardTitle>
          <CardDescription>
            {title}での梱包状態の写真を撮影・保存できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={() => setCurrentCameraTypeV2(type)}
              variant="outline"
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              {title}を撮影
            </Button>

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((image) => (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.url}
                      alt={`${title}画像`}
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => setDeleteImageId(image.id)}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const products =
    formatVersion === "v1" ? orderV1?.products : orderV2?.products

  const cameraDialogOpen =
    formatVersion === "v1"
      ? !!currentCameraTypeV1
      : !!currentCameraTypeV2

  const cameraDialogTitle =
    formatVersion === "v1"
      ? currentCameraTypeV1 === "actual"
        ? "実績箱の撮影"
        : "予測箱の撮影"
      : currentCameraTypeV2
      ? `${IMAGE_TYPE_V2_LABELS[currentCameraTypeV2]}の撮影`
      : ""

  const cameraDialogDescription =
    formatVersion === "v1"
      ? currentCameraTypeV1 === "actual"
        ? "実績箱の梱包状態を撮影してください"
        : "予測箱の梱包状態を撮影してください"
      : currentCameraTypeV2
      ? `${IMAGE_TYPE_V2_LABELS[currentCameraTypeV2]}の梱包状態を撮影してください`
      : ""

  const closeCameraDialog = () => {
    setCurrentCameraTypeV1(null)
    setCurrentCameraTypeV2(null)
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl pt-16 md:pt-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">作業者画面</h1>
        <p className="text-muted-foreground mt-1">
          注文番号を入力して作業を開始します
        </p>
      </div>

      {/* Order search */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">注文検索</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="注文番号を入力"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchOrder()}
              disabled={isLoading || !selectedDataset}
              className="flex-1"
            />
            <Button
              onClick={searchOrder}
              disabled={isLoading || !selectedDataset}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">確定</span>
            </Button>
          </div>
          {!selectedDataset && (
            <p className="text-sm text-muted-foreground mt-2">
              サイドバーからデータセットを選択してください
            </p>
          )}
        </CardContent>
      </Card>

      {/* Order details */}
      {order && (
        <div className="space-y-6">
          {/* Order info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                注文情報
              </CardTitle>
              <CardDescription>注文番号: {order.order_number}</CardDescription>
            </CardHeader>
            <CardContent>
              {formatVersion === "v1" && orderV1 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">総数量</Label>
                    <p className="font-medium text-lg">
                      {orderV1.total_quantity}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      適用サイズ(実績)
                    </Label>
                    <p className="font-medium">{orderV1.actual_size || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      適用サイズ(予測)
                    </Label>
                    <p className="font-medium">
                      {orderV1.predicted_size || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      充填率(対予測)
                    </Label>
                    <p className="font-medium">
                      {(orderV1.fill_rate * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">種別</Label>
                    <p className="font-medium">{orderV1.type || "-"}</p>
                  </div>
                </div>
              ) : orderV2 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        箱実績
                      </Label>
                      <p className="font-medium">
                        {orderV2.actual_size || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        箱予想（GLPK）
                      </Label>
                      <p className="font-medium">
                        {orderV2.predicted_size_glpk || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        箱予想（GA）
                      </Label>
                      <p className="font-medium">
                        {orderV2.predicted_size_ga || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        箱予想（機械学習）
                      </Label>
                      <p className="font-medium">
                        {orderV2.predicted_size_ml || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        箱予想（最終）
                      </Label>
                      <p className="font-medium text-emerald-700">
                        {orderV2.predicted_size_final || "-"}
                      </p>
                    </div>
                  </div>
                  {orderV2.remarks && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        備考
                      </Label>
                      <p className="font-medium whitespace-pre-wrap text-sm bg-muted/50 p-2 rounded">
                        {orderV2.remarks}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Products list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Box className="h-5 w-5" />
                商品一覧
              </CardTitle>
              <CardDescription>
                ピッキング済みの商品にチェックを入れてください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {products?.map((product) => (
                  <div
                    key={product.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      checkedProducts.has(product.id)
                        ? "bg-green-50 border-green-200"
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={product.id}
                        checked={checkedProducts.has(product.id)}
                        onCheckedChange={(checked) =>
                          handleProductCheck(product.id, checked as boolean)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                            {product.product_code}
                          </span>
                          <span className="text-sm font-medium">
                            x{product.quantity}
                          </span>
                          {product.category && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {product.category}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {product.product_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Ruler className="h-3 w-3" />
                          <span>
                            {product.lx} x {product.ly} x {product.lz}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recorder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">記入者</CardTitle>
              <CardDescription>
                作業担当者の名前を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="記入者名"
                  value={recorder}
                  onChange={(e) => setRecorder(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleRecorderSave}>
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* PoC Packing Size */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">PoC梱包サイズ</CardTitle>
              <CardDescription>
                実際の梱包サイズを選択してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={pocPackingSize}
                onValueChange={handlePackingSizeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="サイズを選択" />
                </SelectTrigger>
                <SelectContent>
                  {PACKING_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Images */}
          {formatVersion === "v1" ? (
            <>
              {renderImagesSectionV1("actual", "実績箱")}
              {renderImagesSectionV1("predicted", "予測箱")}
            </>
          ) : (
            IMAGE_TYPE_V2_ORDER.map((type) => renderImagesSectionV2(type))
          )}

          {/* Memo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">メモ</CardTitle>
              <CardDescription>
                フリーテキストでメモを残せます
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="メモを入力..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={4}
              />
              <div className="flex items-center justify-between">
                {hasUnsavedMemo && (
                  <span className="text-sm text-amber-600">
                    未保存の変更があります
                  </span>
                )}
                <Button
                  onClick={handleMemoSave}
                  disabled={isSaving || !hasUnsavedMemo}
                  className="ml-auto"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Camera dialog */}
      <Dialog
        open={cameraDialogOpen}
        onOpenChange={(open) => !open && closeCameraDialog()}
      >
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{cameraDialogTitle}</DialogTitle>
            <DialogDescription>{cameraDialogDescription}</DialogDescription>
          </DialogHeader>
          <CameraCapture
            onCapture={handleImageCapture}
            onClose={closeCameraDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteImageId}
        onOpenChange={(open) => !open && setDeleteImageId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。画像は完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImageDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
