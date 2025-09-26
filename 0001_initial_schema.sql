-- 資料カテゴリテーブル
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 資料テーブル
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  author_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  download_url TEXT,
  category_id INTEGER NOT NULL,
  tags TEXT, -- JSON形式でタグを保存
  keywords TEXT, -- 検索用キーワード（タイトル、説明、タグの結合）
  download_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_author ON materials(author_name);
CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(file_type);
CREATE INDEX IF NOT EXISTS idx_materials_keywords ON materials(keywords);
CREATE INDEX IF NOT EXISTS idx_materials_created ON materials(created_at DESC);

-- カテゴリの初期データ投入
INSERT OR IGNORE INTO categories (id, name, description) VALUES 
  (1, '健康な生活と病気の予防①', '健康の保持増進と疾病の予防の基礎'),
  (2, '心身の発達と心の健康', '身体機能の発達と心の健康に関する学習'),
  (3, '健康な生活と病気の予防②', '生活習慣病などの予防と健康管理'),
  (4, '傷害の防止', '交通事故や自然災害などの傷害防止'),
  (5, '健康な生活と病気の予防③', '感染症の予防と保健・医療機関の活用'),
  (6, '健康と環境', '環境と健康との関わりについて');