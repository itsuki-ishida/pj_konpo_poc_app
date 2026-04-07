export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// CSV/UI で扱うフォーマットバージョン
export type FormatVersion = 'v1' | 'v2'

// v2 で扱う画像種別
export type ImageTypeV1 = 'actual' | 'predicted'
export type ImageTypeV2 = 'actual' | 'glpk' | 'ga' | 'ml' | 'final'

export interface Database {
  public: {
    Tables: {
      datasets: {
        Row: {
          id: string
          name: string
          format_version: FormatVersion
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          format_version?: FormatVersion
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          format_version?: FormatVersion
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          dataset_id: string
          order_number: string
          total_quantity: number
          actual_size: string
          predicted_size: string
          fill_rate: number
          type: string
          recorder: string | null
          poc_packing_size: string | null
          memo: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dataset_id: string
          order_number: string
          total_quantity: number
          actual_size: string
          predicted_size: string
          fill_rate: number
          type: string
          recorder?: string | null
          poc_packing_size?: string | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dataset_id?: string
          order_number?: string
          total_quantity?: number
          actual_size?: string
          predicted_size?: string
          fill_rate?: number
          type?: string
          recorder?: string | null
          poc_packing_size?: string | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          order_id: string
          product_code: string
          product_name: string
          category: string | null
          quantity: number
          lx: number
          ly: number
          lz: number
          is_checked: boolean
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_code: string
          product_name: string
          category?: string | null
          quantity: number
          lx: number
          ly: number
          lz: number
          is_checked?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_code?: string
          product_name?: string
          category?: string | null
          quantity?: number
          lx?: number
          ly?: number
          lz?: number
          is_checked?: boolean
          created_at?: string
        }
      }
      images: {
        Row: {
          id: string
          order_id: string
          url: string
          image_type: ImageTypeV1
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          url: string
          image_type: ImageTypeV1
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          url?: string
          image_type?: ImageTypeV1
          created_at?: string
        }
      }
      orders_v2: {
        Row: {
          id: string
          dataset_id: string
          order_number: string
          actual_size: string
          predicted_size_glpk: string
          predicted_size_ga: string
          predicted_size_ml: string
          predicted_size_final: string
          remarks: string | null
          recorder: string | null
          poc_packing_size: string | null
          memo: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dataset_id: string
          order_number: string
          actual_size?: string
          predicted_size_glpk?: string
          predicted_size_ga?: string
          predicted_size_ml?: string
          predicted_size_final?: string
          remarks?: string | null
          recorder?: string | null
          poc_packing_size?: string | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dataset_id?: string
          order_number?: string
          actual_size?: string
          predicted_size_glpk?: string
          predicted_size_ga?: string
          predicted_size_ml?: string
          predicted_size_final?: string
          remarks?: string | null
          recorder?: string | null
          poc_packing_size?: string | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products_v2: {
        Row: {
          id: string
          order_id: string
          product_code: string
          product_name: string
          category: string | null
          quantity: number
          lx: number
          ly: number
          lz: number
          is_checked: boolean
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_code: string
          product_name: string
          category?: string | null
          quantity: number
          lx: number
          ly: number
          lz: number
          is_checked?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_code?: string
          product_name?: string
          category?: string | null
          quantity?: number
          lx?: number
          ly?: number
          lz?: number
          is_checked?: boolean
          created_at?: string
        }
      }
      images_v2: {
        Row: {
          id: string
          order_id: string
          url: string
          image_type: ImageTypeV2
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          url: string
          image_type: ImageTypeV2
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          url?: string
          image_type?: ImageTypeV2
          created_at?: string
        }
      }
    }
  }
}

// Utility types for easier usage
export type Dataset = Database['public']['Tables']['datasets']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type OrderImage = Database['public']['Tables']['images']['Row']

export type OrderV2 = Database['public']['Tables']['orders_v2']['Row']
export type ProductV2 = Database['public']['Tables']['products_v2']['Row']
export type OrderImageV2 = Database['public']['Tables']['images_v2']['Row']

export type OrderWithProducts = Order & {
  products: Product[]
  images: OrderImage[]
}

export type OrderV2WithProducts = OrderV2 & {
  products: ProductV2[]
  images: OrderImageV2[]
}

export type DatasetWithOrders = Dataset & {
  orders: Order[]
}
