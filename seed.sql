-- テスト用サンプル資料データ
INSERT OR IGNORE INTO materials (
  title, description, author_name, file_name, file_type, file_size, 
  file_url, download_url, category_id, tags, keywords
) VALUES 
  (
    '生活習慣病の予防について',
    '中学生向けの生活習慣病予防に関する基礎的な内容をまとめた資料です。食事、運動、睡眠の重要性について説明しています。',
    '田中先生',
    'lifestyle_diseases_prevention.pdf',
    'application/pdf',
    1024000,
    '/uploads/lifestyle_diseases_prevention.pdf',
    '/api/download/lifestyle_diseases_prevention.pdf',
    3,
    '["生活習慣病", "予防", "食事", "運動", "睡眠"]',
    '生活習慣病の予防について 中学生向けの生活習慣病予防に関する基礎的な内容をまとめた資料です。食事、運動、睡眠の重要性について説明しています。 田中先生 生活習慣病 予防 食事 運動 睡眠'
  ),
  (
    '心の健康とストレス対処法',
    'ストレスの原因と対処方法について分かりやすく解説したプレゼンテーション資料です。',
    '佐藤先生', 
    'mental_health_stress.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    2048000,
    '/uploads/mental_health_stress.pptx',
    '/api/download/mental_health_stress.pptx',
    2,
    '["メンタルヘルス", "ストレス", "対処法", "心の健康"]',
    '心の健康とストレス対処法 ストレスの原因と対処方法について分かりやすく解説したプレゼンテーション資料です。 佐藤先生 メンタルヘルス ストレス 対処法 心の健康'
  ),
  (
    '交通安全指導資料',
    '自転車の安全な乗り方と交通ルールについてまとめた指導用資料です。',
    '鈴木先生',
    'traffic_safety_guide.docx', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    512000,
    '/uploads/traffic_safety_guide.docx',
    '/api/download/traffic_safety_guide.docx',
    4,
    '["交通安全", "自転車", "交通ルール", "安全指導"]',
    '交通安全指導資料 自転車の安全な乗り方と交通ルールについてまとめた指導用資料です。 鈴木先生 交通安全 自転車 交通ルール 安全指導'
  ),
  (
    '健康と環境についてのプレゼンテーション',
    '大気汚染や水質汚濁が健康に与える影響について分かりやすく解説したGoogleスライドです。',
    '山田先生',
    'url_health_environment_slides',
    'application/vnd.google-apps.presentation',
    0,
    'https://docs.google.com/presentation/d/1example_health_environment/edit#slide=id.p',
    'https://docs.google.com/presentation/d/1example_health_environment/edit#slide=id.p',
    6,
    '["環境", "健康", "大気汚染", "水質", "Googleスライド"]',
    '健康と環境についてのプレゼンテーション 大気汚染や水質汚濁が健康に与える影響について分かりやすく解説したGoogleスライドです。 山田先生 環境 健康 大気汚染 水質 Googleスライド'
  );