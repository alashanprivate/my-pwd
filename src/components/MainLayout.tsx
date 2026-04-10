import { useState, useMemo } from 'react';
import { Search, Lock, Plus, Settings, Trash2, Star, LayoutGrid, X, ChevronDown, ChevronRight, KeyRound, FolderTree, Filter } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import logoUrl from '../assets/logo.png';
import AllPasswords from './AllPasswords';
import SettingsModal from './SettingsModal';
import EntryModal from './EntryModal';
import CategoryManagement from './CategoryManagement';

export default function MainLayout({ onLock }: { onLock: () => void }) {
  const {
    currentView,
    selectedCategory,
    searchQuery,
    searchCategory,
    setSearchQuery,
    setSearchCategory,
    entries,
    categories,
    setCurrentView,
    setSelectedCategory,
  } = useStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 搜索防抖：200ms 延迟，避免高频输入触发过多过滤计算
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 200);

  const filteredEntries = useMemo(() => entries.filter(entry => {
    if (currentView === 'categories') return false; // 不在分类管理视图中显示条目
    if (currentView === 'trash' && !entry.deleted) return false;
    if (currentView !== 'trash' && entry.deleted) return false;
    if (currentView === 'favorites' && !entry.favorite) return false;
    if (currentView === 'category' && entry.category_id !== selectedCategory) return false;

    // 分类筛选
    if (searchCategory && entry.category_id !== searchCategory) return false;

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      return (
        entry.title.toLowerCase().includes(query) ||
        entry.username.toLowerCase().includes(query) ||
        entry.url.toLowerCase().includes(query)
      );
    }

    return true;
  }), [entries, currentView, selectedCategory, searchCategory, debouncedSearchQuery]);

  const handleAddEntry = () => {
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  };

  const handleEditEntry = (id: string) => {
    setEditingEntry(id);
    setIsEntryModalOpen(true);
  };

  const handleViewChange = (view: typeof currentView, categoryId?: string) => {
    setCurrentView(view);
    setSelectedCategory(categoryId || null);
    // 切换到分类管理视图时，清空搜索和筛选
    if (view === 'categories') {
      setSearchQuery('');
      setSearchCategory(null);
    }
  };

  return (
    <div className="h-full w-full flex bg-white dark:bg-dark-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TopBar */}
        <TopBar onLock={onLock} onSettings={() => setIsSettingsOpen(true)} />

        {/* Main panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Content */}
          <div className="flex-1 overflow-auto scrollbar-thin p-6">
            {/* Header */}
            <div className="mb-4">
              {/* 搜索框和按钮行 */}
              {currentView !== 'categories' ? (
                // 密码列表视图：搜索框 + 分类筛选 + 添加密码按钮
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索密码..."
                      className="w-full pl-10 pr-10 py-2 bg-white dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* 分类筛选下拉框 */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={searchCategory || ''}
                      onChange={(e) => setSearchCategory(e.target.value || null)}
                      className="pl-9 pr-8 py-2 bg-white dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 appearance-none cursor-pointer min-w-[140px]"
                    >
                      <option value="">全部分类</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>

                  {/* 添加密码按钮 */}
                  <button
                    onClick={handleAddEntry}
                    className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    添加密码
                  </button>
                </div>
              ) : (
                // 分类管理视图：搜索框
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索分类..."
                      className="w-full pl-10 pr-10 py-2 bg-white dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            {currentView === 'categories' ? (
              <CategoryManagement searchQuery={searchQuery} />
            ) : (
              <AllPasswords
                entries={filteredEntries}
                categories={categories}
                onEdit={handleEditEntry}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {isEntryModalOpen && (
        <EntryModal
          entryId={editingEntry}
          onClose={() => setIsEntryModalOpen(false)}
          categories={categories}
        />
      )}
    </div>
  );
}

function TopBar({ onLock, onSettings }: { onLock: () => void; onSettings: () => void }) {
  return (
    <header className="h-16 border-b border-gray-200 dark:border-dark-700 flex items-center justify-end px-6 bg-gray-50/50 dark:bg-dark-900/50 flex-shrink-0">

      <div className="flex items-center gap-2">
        <button
          onClick={onLock}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-800 rounded-lg transition-colors"
          title="锁定密钥库"
        >
          <Lock className="w-5 h-5" />
        </button>
        <button
          onClick={onSettings}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-800 rounded-lg transition-colors"
          title="设置"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

function Sidebar({
  isCollapsed,
  onToggleCollapse,
  currentView,
  onViewChange,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentView: 'all' | 'favorites' | 'trash' | 'category' | 'categories';
  onViewChange: (view: 'all' | 'favorites' | 'trash' | 'category' | 'categories', categoryId?: string) => void;
}) {
  const { categories, selectedCategory } = useStore();
  const [passwordMenuOpen, setPasswordMenuOpen] = useState(true);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(true);

  return (
    <aside
      className={`${isCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 border-r border-gray-200 dark:border-dark-700 bg-gray-50/30 dark:bg-dark-900/30 flex flex-col transition-all duration-300`}
    >
      {/* Branding / Logo */}
      <div className="h-16 border-b border-gray-200 dark:border-dark-700 flex items-center justify-center px-4 overflow-hidden flex-shrink-0">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 w-full'}`}>
          <div className="min-w-[32px] w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm flex items-center justify-center">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              我的密码
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto scrollbar-thin mt-2">
        <nav className="p-2 space-y-1">
          {/* ========== 密码管理分组 ========== */}
          {!isCollapsed && (
            <button
              onClick={() => setPasswordMenuOpen(!passwordMenuOpen)}
              className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span className="flex items-center gap-3 font-medium">
                <KeyRound className="w-5 h-5" />
                密码管理
              </span>
              {passwordMenuOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}

          {/* 密码管理的二级菜单项：展开或收起时始终展示 */}
          {(passwordMenuOpen || isCollapsed) && (
            <>
              <button
                onClick={() => onViewChange('all')}
                title={isCollapsed ? "全部密码" : undefined}
                className={`w-full ${isCollapsed ? 'justify-center px-3' : 'pl-10 pr-3'} py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                  currentView === 'all'
                    ? 'bg-accent-500/10 text-accent-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>全部密码</span>}
              </button>

              <button
                onClick={() => onViewChange('favorites')}
                title={isCollapsed ? "收藏" : undefined}
                className={`w-full ${isCollapsed ? 'justify-center px-3' : 'pl-10 pr-3'} py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                  currentView === 'favorites'
                    ? 'bg-accent-500/10 text-accent-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Star className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>收藏</span>}
              </button>

              <button
                onClick={() => onViewChange('trash')}
                title={isCollapsed ? "垃圾桶" : undefined}
                className={`w-full ${isCollapsed ? 'justify-center px-3' : 'pl-10 pr-3'} py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                  currentView === 'trash'
                    ? 'bg-accent-500/10 text-accent-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Trash2 className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>垃圾桶</span>}
              </button>
            </>
          )}

          {/* 收起时的分组分割线 */}
          {isCollapsed && <div className="my-3 border-t border-gray-200 dark:border-dark-700 w-8 mx-auto" />}

          {/* ========== 分类管理分组 ========== */}
          {!isCollapsed && (
            <button
              onClick={() => setCategoryMenuOpen(!categoryMenuOpen)}
              className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-white transition-colors mt-2"
            >
              <span className="flex items-center gap-3 font-medium">
                <FolderTree className="w-5 h-5" />
                分类管理
              </span>
              {categoryMenuOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}

          {/* 分类管理的二级菜单项：全部分类 + 自定义分类 */}
          {(categoryMenuOpen || isCollapsed) && (
            <>
              {/* 全部分类 */}
              <button
                onClick={() => onViewChange('categories')}
                title={isCollapsed ? "全部分类菜单" : undefined}
                className={`w-full ${isCollapsed ? 'justify-center px-3' : 'pl-10 pr-3'} py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                  currentView === 'categories'
                    ? 'bg-accent-500/10 text-accent-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <FolderTree className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>全部分类</span>}
              </button>

              {/* 具体子分类 */}
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onViewChange('category', c.id)}
                  title={isCollapsed ? c.name : undefined}
                  className={`w-full ${isCollapsed ? 'justify-center px-3' : 'pl-10 pr-3'} py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    currentView === 'category' && selectedCategory === c.id
                      ? 'bg-accent-500/10 text-accent-500'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="w-5 flex justify-center flex-shrink-0 text-base">{c.icon}</span>
                  {!isCollapsed && <span className="truncate">{c.name}</span>}
                </button>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-gray-200 dark:border-dark-700">
        <button
          onClick={onToggleCollapse}
          className="w-full px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors flex items-center justify-center"
        >
          <LayoutGrid className={`w-5 h-5 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </aside>
  );
}
