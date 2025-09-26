// グローバル変数
let currentMaterials = [];
let categories = [];
let currentView = 'category'; // 'grid' または 'category'
let currentCategory = 'all';

// DOM読み込み完了後の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// アプリケーション初期化
async function initializeApp() {
    // ダークモード設定の読み込み
    initializeDarkMode();
    
    // イベントリスナーの設定
    setupEventListeners();
    
    // データの初期読み込み
    await loadCategories();
    await loadMaterials();
}

// ダークモード初期化
function initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
    }
}

// イベントリスナー設定
function setupEventListeners() {
    // ダークモード切り替え
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', toggleDarkMode);
    
    // アップロードボタン
    const uploadBtn = document.getElementById('upload-btn');
    uploadBtn.addEventListener('click', openUploadModal);
    
    // ビュー切り替え
    const viewToggleGrid = document.getElementById('view-toggle-grid');
    const viewToggleCategory = document.getElementById('view-toggle-category');
    
    viewToggleGrid.addEventListener('click', () => switchView('grid'));
    viewToggleCategory.addEventListener('click', () => switchView('category'));
    
    // モーダル関連
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');
    const modalSubmit = document.getElementById('modal-submit');
    
    modalClose.addEventListener('click', closeUploadModal);
    modalCancel.addEventListener('click', closeUploadModal);
    modalSubmit.addEventListener('click', handleUpload);
    
    // アップロードタイプ切り替え
    const uploadFileRadio = document.getElementById('upload-file');
    const uploadUrlRadio = document.getElementById('upload-url');
    
    if (uploadFileRadio && uploadUrlRadio) {
        uploadFileRadio.addEventListener('change', toggleUploadType);
        uploadUrlRadio.addEventListener('change', toggleUploadType);
    }
    
    // 検索・フィルター
    const searchInput = document.getElementById('search');
    const categoryFilter = document.getElementById('category-filter');
    
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadMaterials();
        }, 300);
    });
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            loadMaterials();
        });
    }
    
    // モーダル背景クリックで閉じる
    const uploadModal = document.getElementById('upload-modal');
    uploadModal.addEventListener('click', function(e) {
        if (e.target === uploadModal) {
            closeUploadModal();
        }
    });
}

// ダークモード切り替え
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// カテゴリ読み込み
async function loadCategories() {
    try {
        showLoading(true);
        const response = await axios.get('/api/categories');
        
        if (response.data.success) {
            categories = response.data.data;
            updateCategorySelects();
        } else {
            showError('カテゴリの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showError('カテゴリの読み込み中にエラーが発生しました');
    }
}

// カテゴリセレクトボックス更新
function updateCategorySelects() {
    const categoryFilter = document.getElementById('category-filter');
    const categorySelect = document.getElementById('category');
    
    // フィルター用セレクトボックス（グリッドビューのみ）
    if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="all">すべてのカテゴリ</option>';
        categories.forEach(cat => {
            categoryFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    
    // アップロード用セレクトボックス
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">カテゴリを選択</option>';
        categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    
    // カテゴリタブの更新
    updateCategoryTabs();
}

// カテゴリタブ更新
function updateCategoryTabs() {
    const categoryTabs = document.getElementById('category-tabs');
    if (!categoryTabs) return;
    
    // 全てタブ
    let tabsHtml = `
        <button class="category-tab ${currentCategory === 'all' ? 'active' : ''} py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap" data-category="all">
            すべて <span class="category-count ml-2 text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full">0</span>
        </button>
    `;
    
    // 各カテゴリタブ
    categories.forEach(cat => {
        tabsHtml += `
            <button class="category-tab ${currentCategory === cat.id.toString() ? 'active' : ''} py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap" data-category="${cat.id}">
                ${cat.name} <span class="category-count ml-2 text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full">0</span>
            </button>
        `;
    });
    
    categoryTabs.innerHTML = tabsHtml;
    
    // タブクリックイベント追加
    categoryTabs.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const categoryId = this.dataset.category;
            switchCategory(categoryId);
        });
    });
}

// 資料読み込み
async function loadMaterials() {
    try {
        showLoading(true);
        
        const searchTerm = document.getElementById('search').value;
        
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        
        // グリッドビューの場合のみカテゴリフィルターを適用
        if (currentView === 'grid') {
            const categoryFilter = document.getElementById('category-filter');
            if (categoryFilter && categoryFilter.value !== 'all') {
                params.append('category', categoryFilter.value);
            }
        }
        
        const response = await axios.get(`/api/materials?${params.toString()}`);
        
        if (response.data.success) {
            currentMaterials = response.data.data;
            updateDisplay();
        } else {
            showError('資料の読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Error loading materials:', error);
        showError('資料の読み込み中にエラーが発生しました');
    } finally {
        showLoading(false);
    }
}

// 表示更新（ビューに応じて）
function updateDisplay() {
    if (currentView === 'grid') {
        updateMaterialsGrid();
    } else {
        updateCategoryView();
    }
}

// 資料グリッド更新
function updateMaterialsGrid() {
    const grid = document.getElementById('materials-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (currentMaterials.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    grid.classList.remove('hidden');
    
    grid.innerHTML = currentMaterials.map(material => createMaterialCard(material)).join('');
}

// カテゴリビュー更新
function updateCategoryView() {
    const container = document.getElementById('category-materials-container');
    const emptyState = document.getElementById('empty-state');
    
    // 検索フィルターを適用
    const searchTerm = document.getElementById('search').value.toLowerCase();
    let filteredMaterials = currentMaterials;
    
    if (searchTerm) {
        filteredMaterials = currentMaterials.filter(material => 
            material.title.toLowerCase().includes(searchTerm) ||
            material.description.toLowerCase().includes(searchTerm) ||
            material.author_name.toLowerCase().includes(searchTerm) ||
            (material.tags && material.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }
    
    // カテゴリでフィルター（現在選択中のタブ）
    if (currentCategory !== 'all') {
        filteredMaterials = filteredMaterials.filter(material => 
            material.category_id.toString() === currentCategory
        );
    }
    
    if (filteredMaterials.length === 0) {
        container.innerHTML = '<div class="text-center py-8"><p class="text-gray-500 dark:text-gray-400">該当する資料がありません</p></div>';
        emptyState.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        
        if (currentCategory === 'all') {
            // 全カテゴリを表示
            container.innerHTML = generateCategoryViewContent(filteredMaterials);
        } else {
            // 特定カテゴリのみ表示
            const categoryName = categories.find(cat => cat.id.toString() === currentCategory)?.name || 'カテゴリ';
            container.innerHTML = `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">${categoryName}</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        ${filteredMaterials.map(material => createMaterialCard(material)).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    // カテゴリタブの資料数を更新
    updateCategoryCounts(currentMaterials);
}

// カテゴリビューのコンテンツ生成
function generateCategoryViewContent(materials) {
    let content = '';
    
    // 全カテゴリの資料数表示
    const allCategoryCounts = {};
    materials.forEach(material => {
        const catId = material.category_id;
        allCategoryCounts[catId] = (allCategoryCounts[catId] || 0) + 1;
    });
    
    // カテゴリ順に表示
    categories.forEach(category => {
        const categoryMaterials = materials.filter(m => m.category_id === category.id);
        
        if (categoryMaterials.length > 0) {
            content += `
                <div class="mb-8">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${category.name}</h3>
                        <span class="text-sm text-gray-500 dark:text-gray-400">${categoryMaterials.length}件</span>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        ${categoryMaterials.map(material => createMaterialCard(material)).join('')}
                    </div>
                </div>
            `;
        }
    });
    
    return content || '<div class="text-center py-8"><p class="text-gray-500 dark:text-gray-400">資料がありません</p></div>';
}

// カテゴリタブの資料数更新
function updateCategoryCounts(materials) {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    
    // 検索フィルターを適用した材料
    let filteredMaterials = materials;
    if (searchTerm) {
        filteredMaterials = materials.filter(material => 
            material.title.toLowerCase().includes(searchTerm) ||
            material.description.toLowerCase().includes(searchTerm) ||
            material.author_name.toLowerCase().includes(searchTerm) ||
            (material.tags && material.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }
    
    // 全タブ
    const allTab = document.querySelector('.category-tab[data-category="all"] .category-count');
    if (allTab) {
        allTab.textContent = filteredMaterials.length;
    }
    
    // 各カテゴリタブ
    categories.forEach(category => {
        const categoryMaterials = filteredMaterials.filter(m => m.category_id === category.id);
        const tab = document.querySelector(`.category-tab[data-category="${category.id}"] .category-count`);
        if (tab) {
            tab.textContent = categoryMaterials.length;
        }
    });
}

// 資料カード作成
function createMaterialCard(material) {
    const fileIcon = getFileIcon(material.file_type);
    const tags = material.tags || [];
    const tagsHtml = tags.map(tag => 
        `<span class="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">${tag}</span>`
    ).join(' ');
    
    return `
        <div class="material-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 fade-in">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center">
                    <i class="${fileIcon} text-2xl text-gray-600 dark:text-gray-400 mr-3"></i>
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">${material.title}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">by ${material.author_name}</p>
                    </div>
                </div>
                <div class="relative">
                    <button class="material-menu-btn text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" data-id="${material.id}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="material-menu absolute right-0 top-8 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-10 hidden min-w-[120px]">
                        <button class="edit-material w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600" data-id="${material.id}">
                            <i class="fas fa-edit mr-2"></i>編集
                        </button>
                        <button class="delete-material w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600" data-id="${material.id}">
                            <i class="fas fa-trash mr-2"></i>削除
                        </button>
                    </div>
                </div>
            </div>
            
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">${material.description || '説明がありません'}</p>
            
            <div class="flex flex-wrap gap-2 mb-4">
                <span class="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full">
                    ${material.category_name}
                </span>
                ${tagsHtml}
            </div>
            
            <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span><i class="fas fa-download mr-1"></i>${material.download_count || 0}回</span>
                <span><i class="fas fa-clock mr-1"></i>${formatDate(material.created_at)}</span>
            </div>
            
            <button class="download-btn w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors" 
                    data-id="${material.id}" data-url="${material.download_url}" data-filename="${material.file_name}">
                <i class="fas ${material.download_url.startsWith('http') ? 'fa-external-link-alt' : 'fa-download'} mr-2"></i>
                ${material.download_url.startsWith('http') ? '資料を開く' : 'ダウンロード'}
            </button>
        </div>
    `;
}

// ファイルアイコン取得
function getFileIcon(fileType) {
    if (fileType.includes('pdf')) return 'fas fa-file-pdf text-red-500';
    if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word text-blue-500';
    if (fileType.includes('sheet') || fileType.includes('spreadsheet')) return 'fas fa-file-excel text-green-500';
    if (fileType.includes('presentation') || fileType.includes('google-apps.presentation')) return 'fas fa-file-powerpoint text-orange-500';
    if (fileType.includes('google-apps')) return 'fab fa-google-drive text-blue-600';
    return 'fas fa-file text-gray-500';
}

// 日付フォーマット
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// アップロードモーダルを開く
function openUploadModal() {
    const modal = document.getElementById('upload-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// アップロードモーダルを閉じる
function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    
    // フォームリセット
    document.getElementById('upload-form').reset();
}

// アップロードタイプ切り替え
function toggleUploadType() {
    const uploadType = document.querySelector('input[name="upload_type"]:checked').value;
    const fileSection = document.getElementById('file-upload-section');
    const urlSection = document.getElementById('url-upload-section');
    
    if (uploadType === 'file') {
        fileSection.classList.remove('hidden');
        urlSection.classList.add('hidden');
    } else {
        fileSection.classList.add('hidden');
        urlSection.classList.remove('hidden');
    }
}

// アップロード処理
async function handleUpload() {
    try {
        const form = document.getElementById('upload-form');
        const formData = new FormData();
        const uploadType = document.querySelector('input[name="upload_type"]:checked').value;
        
        // 基本フォームデータ収集
        formData.append('title', form.title.value);
        formData.append('description', form.description.value);
        formData.append('author_name', form.author_name.value);
        formData.append('category_id', form.category_id.value);
        formData.append('upload_type', uploadType);
        
        // タグ処理
        const tagsInput = form.tags.value;
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        formData.append('tags', JSON.stringify(tags));
        
        // アップロードタイプに応じた処理
        if (uploadType === 'file') {
            const fileInput = document.getElementById('file');
            if (!fileInput.files[0]) {
                showError('ファイルを選択してください');
                return;
            }
            formData.append('file', fileInput.files[0]);
        } else {
            const urlInput = document.getElementById('material-url');
            if (!urlInput.value.trim()) {
                showError('URLを入力してください');
                return;
            }
            if (!isValidUrl(urlInput.value.trim())) {
                showError('有効なURLを入力してください');
                return;
            }
            formData.append('material_url', urlInput.value.trim());
        }
        
        // 基本バリデーション
        if (!form.title.value || !form.author_name.value || !form.category_id.value) {
            showError('必須項目を入力してください');
            return;
        }
        
        showLoading(true);
        const response = await axios.post('/api/materials', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        if (response.data.success) {
            if (uploadType === 'url') {
                showSuccess('資料URL が登録されました');
            } else {
                showSuccess('資料がアップロードされました');
            }
            closeUploadModal();
            await loadMaterials(); // 一覧を再読み込み
        } else {
            showError(response.data.error || 'アップロードに失敗しました');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showError('アップロード中にエラーが発生しました');
    } finally {
        showLoading(false);
    }
}

// URL検証ヘルパー関数
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// 資料削除
async function deleteMaterial(id) {
    if (!confirm('この資料を削除しますか？')) {
        return;
    }
    
    try {
        showLoading(true);
        const response = await axios.delete(`/api/materials/${id}`);
        
        if (response.data.success) {
            showSuccess('資料が削除されました');
            await loadMaterials(); // 一覧を再読み込み
        } else {
            showError(response.data.error || '削除に失敗しました');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showError('削除中にエラーが発生しました');
    } finally {
        showLoading(false);
    }
}

// ダウンロード処理
async function downloadMaterial(id, url, filename) {
    try {
        // ダウンロード数をカウント
        await axios.post(`/api/materials/${id}/download`);
        
        // URL資料の場合は新しいタブで開く
        if (url.startsWith('http')) {
            window.open(url, '_blank');
            showSuccess('資料を新しいタブで開きました');
        } else {
            // ローカルファイルの場合（将来のR2対応用）
            showSuccess('ダウンロードを開始しました');
            // 実際のファイルダウンロード実装は R2 Storage 対応時に追加
        }
        
    } catch (error) {
        console.error('Download error:', error);
        showError('アクセス中にエラーが発生しました');
    }
}

// イベントデリゲーション（動的要素のイベント処理）
document.addEventListener('click', function(e) {
    // ダウンロードボタン
    if (e.target.closest('.download-btn')) {
        const btn = e.target.closest('.download-btn');
        const id = btn.dataset.id;
        const url = btn.dataset.url;
        const filename = btn.dataset.filename;
        downloadMaterial(id, url, filename);
    }
    
    // メニューボタン
    if (e.target.closest('.material-menu-btn')) {
        const btn = e.target.closest('.material-menu-btn');
        const menu = btn.nextElementSibling;
        
        // 他のメニューを閉じる
        document.querySelectorAll('.material-menu').forEach(m => {
            if (m !== menu) m.classList.add('hidden');
        });
        
        menu.classList.toggle('hidden');
    }
    
    // 削除ボタン
    if (e.target.closest('.delete-material')) {
        const btn = e.target.closest('.delete-material');
        const id = btn.dataset.id;
        deleteMaterial(id);
    }
    
    // メニュー以外をクリックしたらメニューを閉じる
    if (!e.target.closest('.material-menu-btn') && !e.target.closest('.material-menu')) {
        document.querySelectorAll('.material-menu').forEach(m => m.classList.add('hidden'));
    }
});

// ビュー切り替え
function switchView(view) {
    currentView = view;
    
    const gridSection = document.getElementById('grid-view-section');
    const categorySection = document.getElementById('category-tabs-section');
    const gridToggle = document.getElementById('view-toggle-grid');
    const categoryToggle = document.getElementById('view-toggle-category');
    
    if (view === 'grid') {
        gridSection.classList.remove('hidden');
        categorySection.classList.add('hidden');
        
        // ボタンスタイル更新
        gridToggle.className = 'px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border-b-2 border-primary-600';
        categoryToggle.className = 'px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400';
    } else {
        gridSection.classList.add('hidden');
        categorySection.classList.remove('hidden');
        
        // ボタンスタイル更新
        categoryToggle.className = 'px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border-b-2 border-primary-600';
        gridToggle.className = 'px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400';
    }
    
    updateDisplay();
}

// カテゴリ切り替え
function switchCategory(categoryId) {
    currentCategory = categoryId;
    
    // タブのアクティブ状態を更新
    document.querySelectorAll('.category-tab').forEach(tab => {
        if (tab.dataset.category === categoryId) {
            tab.className = 'category-tab active py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap';
        } else {
            tab.className = 'category-tab py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap';
        }
    });
    
    updateCategoryView();
}

// ユーティリティ関数
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showError(message) {
    // 簡単なアラート（後で改善可能）
    alert('エラー: ' + message);
}

function showSuccess(message) {
    // 簡単なアラート（後で改善可能）
    alert('成功: ' + message);
}