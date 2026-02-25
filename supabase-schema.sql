-- Supabase Schema for 検証データ管理システム
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create datasets table (検証データセット)
CREATE TABLE datasets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table (注文データ)
CREATE TABLE orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL,
    total_quantity INTEGER DEFAULT 0,
    actual_size VARCHAR(50) DEFAULT '',
    predicted_size VARCHAR(50) DEFAULT '',
    fill_rate DECIMAL(10, 5) DEFAULT 0,
    type VARCHAR(100) DEFAULT '',
    poc_packing_size VARCHAR(50) DEFAULT NULL,
    memo TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table (商品データ)
CREATE TABLE products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_code VARCHAR(100) DEFAULT '',
    product_name VARCHAR(500) DEFAULT '',
    quantity INTEGER DEFAULT 0,
    lx INTEGER DEFAULT 0,
    ly INTEGER DEFAULT 0,
    lz INTEGER DEFAULT 0,
    is_checked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create images table (画像データ)
CREATE TABLE images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_orders_dataset_id ON orders(dataset_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_products_order_id ON products(order_id);
CREATE INDEX idx_images_order_id ON images(order_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for orders table
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (since no auth required)
CREATE POLICY "Allow all operations on datasets" ON datasets FOR ALL USING (true);
CREATE POLICY "Allow all operations on orders" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true);
CREATE POLICY "Allow all operations on images" ON images FOR ALL USING (true);

-- Create storage bucket for images
-- NOTE: Run this in SQL Editor or use Supabase Dashboard
-- INSERT INTO storage.buckets (id, name, public) VALUES ('order-images', 'order-images', true);

-- Storage policies (run after creating bucket)
-- CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'order-images');
-- CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'order-images');
-- CREATE POLICY "Allow public delete" ON storage.objects FOR DELETE USING (bucket_id = 'order-images');
