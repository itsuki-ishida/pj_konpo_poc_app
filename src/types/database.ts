export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      datasets: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
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
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          url: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          url?: string
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

export type OrderWithProducts = Order & {
  products: Product[]
  images: OrderImage[]
}

export type DatasetWithOrders = Dataset & {
  orders: Order[]
}
