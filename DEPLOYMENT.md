# 📋 デプロイメントガイド

## Phase1: Cloudflare Pagesでの無料公開

### 前提条件
- GitHubアカウント
- Cloudflareアカウント（無料）

### STEP 1: GitHubリポジトリ作成
1. GitHub で新しいリポジトリを作成
   - Repository name: `health-education-portal`
   - 公開リポジトリとして作成

### STEP 2: コードをGitHubにプッシュ
```bash
# リモートリポジトリを追加
git remote add origin https://github.com/YOUR_USERNAME/health-education-portal.git

# メインブランチにプッシュ
git push -u origin main
```

### STEP 3: Cloudflare Pagesセットアップ
1. **Cloudflare Dashboard** (https://dash.cloudflare.com) にアクセス
2. アカウント作成・ログイン
3. 左メニューから **「Pages」** をクリック
4. **「プロジェクトを作成」** をクリック
5. **「Gitリポジトリに接続」** を選択
6. GitHubを選択して認証
7. リポジトリ `health-education-portal` を選択

### STEP 4: ビルド設定
```
プロジェクト名: health-education-portal
本番ブランチ: main
ビルドコマンド: npm run build
出力ディレクトリ: dist
Node.jsバージョン: 18
```

### STEP 5: 環境変数設定（後で設定）
本番用のD1データベース作成後に設定

### STEP 6: デプロイ完了
- 数分後にデプロイ完了
- アクセスURL: `https://health-education-portal.pages.dev`

## 本番データベース設定

### D1データベース作成
```bash
# Cloudflareにログイン
npx wrangler login

# 本番D1データベース作成
npx wrangler d1 create health-education-portal-prod

# wrangler.jsonc を更新（database_idを設定）

# 本番マイグレーション実行
npx wrangler d1 migrations apply health-education-portal-prod
```

### 環境変数更新
Cloudflare Pages ダッシュボードで環境変数を設定:
- D1データベースの接続情報
- その他の設定値

## 今後の更新方法
```bash
# コード変更後
git add .
git commit -m "機能追加"
git push origin main

# 自動的にCloudflare Pagesが検知して再デプロイ
```

## トラブルシューティング
- ビルドエラー: package.json の dependencies を確認
- データベースエラー: D1の設定とマイグレーションを確認
- アクセスエラー: DNS設定とSSL証明書を確認