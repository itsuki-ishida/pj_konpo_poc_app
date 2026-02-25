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
import type { Order, Product, OrderImage } from "@/types/database"
import {
  Search,
  Camera,
  Save,
  Loader2,
  Package,
  Box,
  Ruler,
  Trash2,
  X,
  ImageIcon,
} from "lucide-react"
import { CameraCapture } from "@/components/camera-capture"

const PACKING_SIZES = [
  "ネコポス大",
  "ネコポス小",
  "コンパクト",
  "60サイズ",
  "80サイズ",
  "100サイズ",
  "120サイズ",
]

interface OrderWithDetails extends Order {
  products: Product[]
  images: OrderImage[]
}

export default function WorkerPage() {
  const { toast } = useToast()
  const [selectedDataset, setSelectedDataset] = React.useState<string>("")
  const [orderNumber, setOrderNumber] = React.useState("")
  const [order, setOrder] = React.useState<OrderWithDetails | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isCameraOpen, setIsCameraOpen] = React.useState(false)
  const [recorder, setRecorder] = React.useState<string>("")
  const [pocPackingSize, setPocPackingSize] = React.useState<string>("")
  const [memo, setMemo] = React.useState("")
  const [originalMemo, setOriginalMemo] = React.useState("")
  const [checkedProducts, setCheckedProducts] = React.useState<Set<string>>(new Set())
  const [deleteImageId, setDeleteImageId] = React.useState<string | null>(null)
  const [hasUnsavedMemo, setHasUnsavedMemo] = React.useState(false)

  // Load selected dataset from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem("selectedDataset")
    if (saved) {
      setSelectedDataset(saved)
    }

    const handleDatasetChange = (e: CustomEvent) => {
      setSelectedDataset(e.detail)
      setOrder(null)
      setOrderNumber("")
    }

    window.addEventListener("datasetChanged", handleDatasetChange as EventListener)
    return () => {
      window.removeEventListener("datasetChanged", handleDatasetChange as EventListener)
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
      // Fetch order with products and images
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          products (*),
          images (*)
        `)
        .eq("dataset_id", selectedDataset)
        .eq("order_number", orderNumber.trim())
        .single()

      if (orderError) {
        if (orderError.code === "PGRST116") {
          toast({
            title: "注文が見つかりません",
            description: `注文番号「${orderNumber}」は存在しません`,
            variant: "destructive",
          })
        } else {
          throw orderError
        }
        setOrder(null)
        return
      }

      setOrder(orderData as OrderWithDetails)
      setRecorder(orderData.recorder || "")
      setPocPackingSize(orderData.poc_packing_size || "")
      setMemo(orderData.memo || "")
      setOriginalMemo(orderData.memo || "")

      // Set checked products
      const checked = new Set<string>()
      orderData.products?.forEach((p: Product) => {
        if (p.is_checked) checked.add(p.id)
      })
      setCheckedProducts(checked)

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

  const handleProductCheck = async (productId: string, checked: boolean) => {
    try {
      const { error } = await supabase
        .from("products")
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

  const handleRecorderSave = async () => {
    if (!order) return

    try {
      const { error } = await supabase
        .from("orders")
        .update({ recorder })
        .eq("id", order.id)

      if (error) throw error

      setOrder((prev) => prev ? { ...prev, recorder } : null)

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

  const handlePackingSizeChange = async (value: string) => {
    if (!order) return

    try {
      const { error } = await supabase
        .from("orders")
        .update({ poc_packing_size: value })
        .eq("id", order.id)

      if (error) throw error

      setPocPackingSize(value)
      setOrder((prev) => prev ? { ...prev, poc_packing_size: value } : null)

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

  const handleMemoSave = async () => {
    if (!order) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from("orders")
        .update({ memo })
        .eq("id", order.id)

      if (error) throw error

      setOriginalMemo(memo)
      setOrder((prev) => prev ? { ...prev, memo } : null)

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

  const handleImageCapture = async (imageDataUrl: string) => {
    if (!order) return

    try {
      // Convert data URL to blob
      const response = await fetch(imageDataUrl)
      const blob = await response.blob()

      // Generate unique filename
      const filename = `${order.order_number}/${Date.now()}.jpg`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("order-images")
        .upload(filename, blob, {
          contentType: "image/jpeg",
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("order-images")
        .getPublicUrl(filename)

      // Save image record to database
      const { data: imageRecord, error: dbError } = await supabase
        .from("images")
        .insert({
          order_id: order.id,
          url: urlData.publicUrl,
        })
        .select()
        .single()

      if (dbError) throw dbError

      // Update local state
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              images: [...prev.images, imageRecord],
            }
          : null
      )

      setIsCameraOpen(false)
      toast({
        title: "保存しました",
        description: "画像をアップロードしました",
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

  const handleImageDelete = async () => {
    if (!deleteImageId || !order) return

    try {
      const image = order.images.find((img) => img.id === deleteImageId)
      if (!image) return

      // Extract filename from URL
      const urlParts = image.url.split("/")
      const filename = urlParts.slice(-2).join("/")

      // Delete from storage
      await supabase.storage.from("order-images").remove([filename])

      // Delete from database
      const { error } = await supabase
        .from("images")
        .delete()
        .eq("id", deleteImageId)

      if (error) throw error

      // Update local state
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              images: prev.images.filter((img) => img.id !== deleteImageId),
            }
          : null
      )

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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">総数量</Label>
                  <p className="font-medium text-lg">{order.total_quantity}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    適用サイズ(実績)
                  </Label>
                  <p className="font-medium">{order.actual_size || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    適用サイズ(予測)
                  </Label>
                  <p className="font-medium">{order.predicted_size || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    充填率(対予測)
                  </Label>
                  <p className="font-medium">
                    {(order.fill_rate * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">種別</Label>
                  <p className="font-medium">{order.type || "-"}</p>
                </div>
              </div>
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
                {order.products.map((product) => (
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                画像記録
              </CardTitle>
              <CardDescription>
                梱包状態の写真を撮影・保存できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  onClick={() => setIsCameraOpen(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  カメラで撮影
                </Button>

                {order.images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {order.images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt="梱包画像"
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
      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>写真撮影</DialogTitle>
            <DialogDescription>
              梱包状態を撮影してください
            </DialogDescription>
          </DialogHeader>
          <CameraCapture
            onCapture={handleImageCapture}
            onClose={() => setIsCameraOpen(false)}
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
