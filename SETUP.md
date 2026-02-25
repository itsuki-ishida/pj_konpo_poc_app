# 検証データ管理システム セットアップガイド

## 必要な準備

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセスしてアカウントを作成
2. 「New Project」をクリックして新しいプロジェクトを作成
3. プロジェクト名とデータベースパスワードを設定

### 2. データベーススキーマの設定

1. Supabaseダッシュボードで「SQL Editor」を開く
2. `supabase-schema.sql`の内容をコピー＆ペースト
3. 「Run」をクリックして実行

### 3. Storageバケットの作成

1. Supabaseダッシュボードで「Storage」を開く
2. 「New bucket」をクリック
3. バケット名: `order-images`
4. 「Public bucket」にチェックを入れる
5. 「Create bucket」をクリック

### 4. Storageポリシーの設定

1. 作成した`order-images`バケットをクリック
2. 「Policies」タブを開く
3. 以下のポリシーを追加:

**INSERT ポリシー (アップロード許可)**
```sql
CREATE POLICY "Allow public upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'order-images');
```

**SELECT ポリシー (閲覧許可)**
```sql
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT USING (bucket_id = 'order-images');
```

**DELETE ポリシー (削除許可)**
```sql
CREATE POLICY "Allow public delete" ON storage.objects
FOR DELETE USING (bucket_id = 'order-images');
```

### 5. 環境変数の設定

1. Supabaseダッシュボードの「Settings」→「API」を開く
2. 以下の値をコピー:
   - Project URL
   - anon/public key

3. プロジェクトルートに`.env.local`ファイルを作成:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

ブラウザで http://localhost:3000 を開く

## Vercelへのデプロイ

### 1. GitHubにプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Vercelでデプロイ

1. [Vercel](https://vercel.com)にログイン
2. 「Add New...」→「Project」をクリック
3. GitHubリポジトリを選択
4. 「Environment Variables」に以下を追加:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. 「Deploy」をクリック

## CSVファイルの形式

アップロードするCSVファイルは以下のヘッダーを含む必要があります:

```
注文番号,商品コード,商品名,数量,種別,適用サイズ_実績,適用サイズ_予測,総数量,充填率,lx,ly,lz
```

### サンプルデータ

```csv
注文番号,商品コード,商品名,数量,種別,適用サイズ_実績,適用サイズ_予測,総数量,充填率,lx,ly,lz
001,172,ﾏｲﾙﾄﾞｿｰﾌﾟ　10個ｾｯﾄ,1,up（GLPK）,60サイズ,80サイズ,5,0.43089,300,156,58
001,173,ﾊﾝﾄﾞｸﾘｰﾑ 5本入り,2,up（GLPK）,60サイズ,80サイズ,5,0.43089,120,80,40
002,174,石鹸セット,1,up（GLPK）,80サイズ,80サイズ,3,0.55,200,150,100
```

## 機能一覧

### データ登録画面 (`/`)
- CSVファイルのアップロード
- データセット名の設定
- プレビュー表示

### 作業者画面 (`/worker`)
- 注文番号検索
- 注文情報の表示
- 商品のピッキングチェック
- PoC梱包サイズの記録
- カメラ撮影・画像保存
- メモ機能

### 管理者画面 (`/admin`)
- データ一覧表示
- 検索・フィルタリング
- Excelエクスポート

## トラブルシューティング

### 画像がアップロードできない
- Supabase Storageのポリシー設定を確認
- バケットが「Public」になっているか確認

### データが表示されない
- Supabaseの接続情報（URL、キー）が正しいか確認
- Row Level Security (RLS) のポリシーが正しく設定されているか確認

### CSVのインポートでエラーが発生する
- CSVファイルのエンコーディングがUTF-8になっているか確認
- 必須のヘッダーがすべて含まれているか確認
