import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
  // R2: R2Bucket; // R2が有効になったら追加
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定
app.use('/api/*', cors())

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }))

// =============================================================================
// API Routes - 資料管理
// =============================================================================

// カテゴリ一覧取得
app.get('/api/categories', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, name, description FROM categories ORDER BY id
    `).all()

    return c.json({ success: true, data: results })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return c.json({ success: false, error: 'Failed to fetch categories' }, 500)
  }
})

// 資料一覧取得（検索・フィルター対応）
app.get('/api/materials', async (c) => {
  try {
    const { category, search, limit = '20', offset = '0' } = c.req.query()
    
    let query = `
      SELECT m.*, c.name as category_name 
      FROM materials m 
      JOIN categories c ON m.category_id = c.id
    `
    const params = []
    const conditions = []

    // カテゴリフィルター
    if (category && category !== 'all') {
      conditions.push('m.category_id = ?')
      params.push(category)
    }

    // キーワード検索
    if (search && search.trim()) {
      conditions.push('m.keywords LIKE ?')
      params.push(`%${search.trim()}%`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const { results } = await c.env.DB.prepare(query).bind(...params).all()

    // タグをJSONパース
    const materials = results.map(material => ({
      ...material,
      tags: material.tags ? JSON.parse(material.tags) : []
    }))

    return c.json({ success: true, data: materials })
  } catch (error) {
    console.error('Error fetching materials:', error)
    return c.json({ success: false, error: 'Failed to fetch materials' }, 500)
  }
})

// 資料詳細取得
app.get('/api/materials/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const { results } = await c.env.DB.prepare(`
      SELECT m.*, c.name as category_name 
      FROM materials m 
      JOIN categories c ON m.category_id = c.id 
      WHERE m.id = ?
    `).bind(id).all()

    if (results.length === 0) {
      return c.json({ success: false, error: 'Material not found' }, 404)
    }

    const material = {
      ...results[0],
      tags: results[0].tags ? JSON.parse(results[0].tags) : []
    }

    return c.json({ success: true, data: material })
  } catch (error) {
    console.error('Error fetching material:', error)
    return c.json({ success: false, error: 'Failed to fetch material' }, 500)
  }
})

// 資料作成（ファイルアップロード・URL共有）
app.post('/api/materials', async (c) => {
  try {
    const formData = await c.req.formData()
    const title = formData.get('title') as string
    const description = formData.get('description') as string || ''
    const authorName = formData.get('author_name') as string
    const categoryId = formData.get('category_id') as string
    const tagsStr = formData.get('tags') as string || '[]'
    const uploadType = formData.get('upload_type') as string
    const materialUrl = formData.get('material_url') as string
    const file = formData.get('file') as File

    if (!title || !authorName || !categoryId) {
      return c.json({ success: false, error: 'Required fields are missing' }, 400)
    }

    let fileName: string
    let fileType: string
    let fileSize: number
    let fileUrl: string
    let downloadUrl: string

    if (uploadType === 'url' && materialUrl) {
      // URL共有の場合
      if (!isValidUrl(materialUrl)) {
        return c.json({ success: false, error: 'Invalid URL format' }, 400)
      }

      // URLからファイルタイプを推測
      fileType = detectUrlFileType(materialUrl)
      fileName = `url_${Date.now()}_${title.replace(/[^a-zA-Z0-9]/g, '_')}`
      fileSize = 0
      fileUrl = materialUrl
      downloadUrl = materialUrl

    } else {
      // ファイルアップロードの場合
      if (!file) {
        return c.json({ success: false, error: 'File is required for file upload' }, 400)
      }

      // ファイル検証
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.google-apps.presentation'
      ]

      if (!allowedTypes.includes(file.type)) {
        return c.json({ success: false, error: 'Unsupported file type' }, 400)
      }

      // ファイル名とURLの生成（現在はモックアップ）
      const timestamp = Date.now()
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      fileName = `${timestamp}_${sanitizedFileName}`
      fileType = file.type
      fileSize = file.size
      fileUrl = `/uploads/${fileName}`
      downloadUrl = `/api/download/${fileName}`
    }

    // タグとキーワードの処理
    const tags = JSON.parse(tagsStr)
    const keywords = [
      title,
      description,
      authorName,
      ...tags
    ].filter(Boolean).join(' ')

    // データベースに保存
    const result = await c.env.DB.prepare(`
      INSERT INTO materials (
        title, description, author_name, file_name, file_type, file_size,
        file_url, download_url, category_id, tags, keywords
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      title, description, authorName, fileName, fileType, fileSize,
      fileUrl, downloadUrl, categoryId, JSON.stringify(tags), keywords
    ).run()

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        title,
        file_name: fileName,
        file_url: fileUrl,
        download_url: downloadUrl,
        upload_type: uploadType
      }
    })

  } catch (error) {
    console.error('Error creating material:', error)
    return c.json({ success: false, error: 'Failed to create material' }, 500)
  }
})

// URL検証ヘルパー関数
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// URLからファイルタイプを推測
function detectUrlFileType(url: string): string {
  if (url.includes('docs.google.com/presentation') || url.includes('slides.google.com')) {
    return 'application/vnd.google-apps.presentation'
  }
  if (url.includes('docs.google.com/document')) {
    return 'application/vnd.google-apps.document'
  }
  if (url.includes('docs.google.com/spreadsheets')) {
    return 'application/vnd.google-apps.spreadsheet'
  }
  if (url.includes('.pdf')) {
    return 'application/pdf'
  }
  if (url.includes('.pptx') || url.includes('.ppt')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
  if (url.includes('.docx') || url.includes('.doc')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (url.includes('.xlsx') || url.includes('.xls')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  
  // デフォルトはGoogle Slidesとして扱う
  return 'application/vnd.google-apps.presentation'
}

// 資料更新
app.put('/api/materials/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { title, description, author_name, category_id, tags } = body

    if (!title || !author_name || !category_id) {
      return c.json({ success: false, error: 'Required fields are missing' }, 400)
    }

    // キーワードの更新
    const keywords = [
      title,
      description,
      author_name,
      ...(tags || [])
    ].filter(Boolean).join(' ')

    const result = await c.env.DB.prepare(`
      UPDATE materials 
      SET title = ?, description = ?, author_name = ?, category_id = ?, 
          tags = ?, keywords = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      title, description, author_name, category_id,
      JSON.stringify(tags || []), keywords, id
    ).run()

    if (result.changes === 0) {
      return c.json({ success: false, error: 'Material not found' }, 404)
    }

    return c.json({ success: true, message: 'Material updated successfully' })

  } catch (error) {
    console.error('Error updating material:', error)
    return c.json({ success: false, error: 'Failed to update material' }, 500)
  }
})

// 資料削除
app.delete('/api/materials/:id', async (c) => {
  try {
    const id = c.req.param('id')

    const result = await c.env.DB.prepare(`
      DELETE FROM materials WHERE id = ?
    `).bind(id).run()

    if (result.changes === 0) {
      return c.json({ success: false, error: 'Material not found' }, 404)
    }

    return c.json({ success: true, message: 'Material deleted successfully' })

  } catch (error) {
    console.error('Error deleting material:', error)
    return c.json({ success: false, error: 'Failed to delete material' }, 500)
  }
})

// ダウンロード数カウント更新
app.post('/api/materials/:id/download', async (c) => {
  try {
    const id = c.req.param('id')

    await c.env.DB.prepare(`
      UPDATE materials SET download_count = download_count + 1 WHERE id = ?
    `).bind(id).run()

    return c.json({ success: true })

  } catch (error) {
    console.error('Error updating download count:', error)
    return c.json({ success: false, error: 'Failed to update download count' }, 500)
  }
})

// =============================================================================
// フロントエンド - メインページ
// =============================================================================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>保健体育科教材共有ポータル</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
          tailwind.config = {
            darkMode: 'class',
            theme: {
              extend: {
                colors: {
                  primary: {
                    50: '#eff6ff',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8'
                  }
                }
              }
            }
          }
        </script>
        <style>
          .fade-in { animation: fadeIn 0.5s ease-in; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .material-card { transition: all 0.3s ease; }
          .material-card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        </style>
    </head>
    <body class="bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <!-- ナビゲーションヘッダー -->
        <nav class="bg-white dark:bg-gray-800 shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <i class="fas fa-graduation-cap text-2xl text-primary-600 mr-3"></i>
                        <h1 class="text-xl font-bold text-gray-800 dark:text-white">保健体育科教材共有ポータル</h1>
                    </div>
                    <div class="flex items-center space-x-4">
                        <button id="theme-toggle" class="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
                            <i class="fas fa-moon dark:hidden"></i>
                            <i class="fas fa-sun hidden dark:inline"></i>
                        </button>
                        <button id="upload-btn" class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                            <i class="fas fa-plus mr-2"></i>資料をアップロード
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- メインコンテンツ -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- 検索・フィルターセクション -->
            <div class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div class="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
                    <div class="flex-1">
                        <label for="search" class="sr-only">検索</label>
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i class="fas fa-search text-gray-400 dark:text-gray-500"></i>
                            </div>
                            <input type="text" id="search" placeholder="キーワードで検索..." 
                                   class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button id="view-toggle-grid" class="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
                            <i class="fas fa-th-large mr-1"></i>グリッド
                        </button>
                        <button id="view-toggle-category" class="px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border-b-2 border-primary-600">
                            <i class="fas fa-list mr-1"></i>カテゴリ別
                        </button>
                    </div>
                </div>
            </div>

            <!-- カテゴリタブセクション -->
            <div id="category-tabs-section" class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div class="border-b border-gray-200 dark:border-gray-700">
                    <nav class="-mb-px flex space-x-8 px-6" id="category-tabs">
                        <button class="category-tab active py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap" data-category="all">
                            すべて <span class="category-count ml-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">0</span>
                        </button>
                    </nav>
                </div>
                <div class="p-6 category-tabs-content">
                    <div id="category-materials-container">
                        <!-- カテゴリ別資料がここに表示されます -->
                    </div>
                </div>
            </div>

            <!-- 通常のグリッド表示（デフォルトは非表示） -->
            <div id="grid-view-section" class="hidden">
                <div class="mb-4">
                    <label for="category-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">カテゴリフィルター</label>
                    <select id="category-filter" class="block w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        <option value="all">すべてのカテゴリ</option>
                    </select>
                </div>

                <!-- 通常のグリッド表示用 -->
                <div id="materials-grid" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <!-- 資料カードがここに動的に追加されます -->
                </div>
            </div>

            <!-- ローディング表示 -->
            <div id="loading" class="text-center py-8 hidden">
                <i class="fas fa-spinner fa-spin text-2xl text-gray-400 dark:text-gray-500"></i>
                <p class="text-gray-500 dark:text-gray-400 mt-2">読み込み中...</p>
            </div>

            <!-- 空状態 -->
            <div id="empty-state" class="text-center py-12 hidden">
                <i class="fas fa-folder-open text-4xl text-gray-400 dark:text-gray-500 mb-4"></i>
                <p class="text-gray-500 dark:text-gray-400 text-lg">該当する資料が見つかりませんでした</p>
            </div>
        </div>

        <!-- アップロードモーダル -->
        <div id="upload-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 overflow-y-auto">
            <div class="flex items-start justify-center min-h-screen p-4 py-8">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full modal-container">
                    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex items-center justify-between">
                            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">資料をアップロード</h2>
                            <button id="modal-close" class="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="px-6 py-4">
                        <form id="upload-form" class="space-y-4">
                            <div>
                                <label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル *</label>
                                <input type="text" id="title" name="title" required 
                                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            </div>
                            <div>
                                <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
                                <textarea id="description" name="description" rows="3" 
                                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                            </div>
                            <div>
                                <label for="author" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">作成者名 *</label>
                                <input type="text" id="author" name="author_name" required 
                                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            </div>
                            <div>
                                <label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">カテゴリ *</label>
                                <select id="category" name="category_id" required 
                                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                </select>
                            </div>
                            <div>
                                <label for="tags" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タグ（カンマ区切り）</label>
                                <input type="text" id="tags" name="tags" placeholder="例: 生活習慣病, 予防, 食事" 
                                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">資料の種類 *</label>
                                <div class="flex space-x-4 mb-3">
                                    <label class="flex items-center">
                                        <input type="radio" name="upload_type" value="file" id="upload-file" checked 
                                               class="mr-2 text-primary-600 focus:ring-primary-500">
                                        <span class="text-sm text-gray-700 dark:text-gray-300">ファイルアップロード</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="radio" name="upload_type" value="url" id="upload-url" 
                                               class="mr-2 text-primary-600 focus:ring-primary-500">
                                        <span class="text-sm text-gray-700 dark:text-gray-300">URL共有</span>
                                    </label>
                                </div>
                                
                                <!-- ファイルアップロード -->
                                <div id="file-upload-section">
                                    <input type="file" id="file" name="file" 
                                           accept=".pdf,.docx,.xlsx,.pptx"
                                           class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF, Word, Excel, PowerPoint対応</p>
                                </div>
                                
                                <!-- URL入力 -->
                                <div id="url-upload-section" class="hidden">
                                    <input type="url" id="material-url" name="material_url" placeholder="https://docs.google.com/presentation/d/..." 
                                           class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Google Slides, Google Docs, 外部資料のURL</p>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                        <button id="modal-cancel" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-100">
                            キャンセル
                        </button>
                        <button id="modal-submit" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md">
                            アップロード
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app