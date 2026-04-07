import type { FormatVersion, ImageTypeV2 } from "@/types/database"

// =============================================================================
// フォーマットメタ情報
// =============================================================================

export const FORMAT_LABELS: Record<FormatVersion, string> = {
  v1: "第1回PoCフォーマット（26年2月）",
  v2: "第2回PoCフォーマット（26年4月）",
}

export const FORMAT_SHORT_LABELS: Record<FormatVersion, string> = {
  v1: "第1回PoC",
  v2: "第2回PoC",
}

// =============================================================================
// CSV ヘッダー定義
// =============================================================================

export const FORMAT_V1_HEADERS = [
  "注文番号",
  "商品コード",
  "商品名",
  "カテゴリ",
  "数量",
  "種別",
  "適用サイズ_実績",
  "適用サイズ_予測",
  "総数量",
  "充填率",
  "lx",
  "ly",
  "lz",
] as const

export const FORMAT_V2_HEADERS = [
  "注文番号",
  "商品名",
  "商品コード",
  "数量",
  "カテゴリ",
  "箱実績",
  "箱予想（GLPK）",
  "箱予想（GA）",
  "箱予想（機械学習）",
  "箱予想（最終）",
  "lx",
  "ly",
  "lz",
  "備考",
] as const

// =============================================================================
// v1 CSV 行型
// =============================================================================

export interface FormatV1Row {
  注文番号: string
  商品コード: string
  商品名: string
  カテゴリ?: string
  数量: string
  種別: string
  適用サイズ_実績: string
  適用サイズ_予測: string
  総数量: string
  充填率: string
  lx: string
  ly: string
  lz: string
}

// =============================================================================
// v2 CSV 行型
// =============================================================================

export interface FormatV2Row {
  注文番号: string
  商品名: string
  商品コード: string
  数量: string
  カテゴリ?: string
  箱実績: string
  "箱予想（GLPK）": string
  "箱予想（GA）": string
  "箱予想（機械学習）": string
  "箱予想（最終）": string
  lx: string
  ly: string
  lz: string
  備考?: string
}

// =============================================================================
// v2 画像種別ラベル
// =============================================================================

export const IMAGE_TYPE_V2_ORDER: ImageTypeV2[] = [
  "actual",
  "glpk",
  "ga",
  "ml",
  "final",
]

export const IMAGE_TYPE_V2_LABELS: Record<ImageTypeV2, string> = {
  actual: "実績箱",
  glpk: "予想箱（GLPK）",
  ga: "予想箱（GA）",
  ml: "予想箱（機械学習）",
  final: "予想箱（最終）",
}

// 短縮ラベル（管理者画面のテーブル等で使用）
export const IMAGE_TYPE_V2_SHORT_LABELS: Record<ImageTypeV2, string> = {
  actual: "実績",
  glpk: "GLPK",
  ga: "GA",
  ml: "ML",
  final: "最終",
}
