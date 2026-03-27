import { useState, useMemo } from 'react';
import { Globe, User, Copy, Star, Trash2, RotateCcw, Eye, EyeOff, ChevronLeft, ChevronRight, Edit } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Entry, Category } from '../store/useStore';
import ConfirmModal from './ConfirmModal';


interface AllPasswordsProps {
  entries: Entry[];
  categories: Category[];
  onEdit: (id: string) => void;
}

const ITEMS_PER_PAGE = 10;

export default function AllPasswords({ entries, categories, onEdit }: AllPasswordsProps) {
  const { deleteEntry, restoreEntry, updateEntry } = useStore();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // 删除确认状态
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryIdToDelete, setEntryIdToDelete] = useState<string | null>(null);


  // 分页数据
  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE);
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return entries.slice(startIndex, endIndex);
  }, [entries, currentPage]);

  // 重置到第一页当数据变化时
  useMemo(() => {
    setCurrentPage(1);
  }, [entries.length]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleFavorite = (id: string, favorite: boolean) => {
    updateEntry(id, { favorite: !favorite });
  };

  const handleDelete = (id: string) => {
    setEntryIdToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (entryIdToDelete) {
      deleteEntry(entryIdToDelete);
      setEntryIdToDelete(null);
    }
  };


  const handleRestore = (id: string) => {
    restoreEntry(id);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCategory = (categoryId: string) => {
    return categories.find(c => c.id === categoryId);
  };

  const hasTrash = entries.some(e => e.deleted);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-dark-800 rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无密码</h3>
        <p className="text-gray-500">
          {hasTrash ? '回收站为空' : '您的密钥库为空，添加第一个密码吧'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 表格 */}
      <div className="bg-gray-50 dark:bg-dark-800/50 border border-gray-200 dark:border-dark-700/50 rounded-lg overflow-hidden">
        {/* 表头 */}
        <div className="grid grid-cols-13 gap-4 px-6 py-3 bg-gray-100 dark:bg-dark-900/50 border-b border-gray-200 dark:border-dark-700 text-sm font-medium text-gray-600 dark:text-gray-400">
          <div className="col-span-1 w-8 text-center">#</div>
          <div className="col-span-2">标题</div>
          <div className="col-span-2">用户名</div>
          <div className="col-span-2">密码</div>
          <div className="col-span-2">网址</div>
          <div className="col-span-2">分类</div>
          <div className="col-span-2">操作</div>
        </div>

        {/* 表格内容 */}
        <div className="divide-y divide-gray-200 dark:divide-dark-700/50">
          {paginatedEntries.map((entry, index) => {
            const category = getCategory(entry.category_id);
            const isPasswordVisible = showPasswords[entry.id];
            const rowNum = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

            return (
              <div
                key={entry.id}
                className="grid grid-cols-13 gap-4 px-6 py-3 hover:bg-gray-100 dark:hover:bg-dark-700/30 transition-colors items-center"
              >
                {/* 行号 */}
                <div className="col-span-1 w-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  {rowNum}
                </div>

                {/* 标题 */}
                <div className="col-span-2 flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ backgroundColor: category?.color || '#6b7280' }}
                  >
                    {entry.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900 dark:text-white text-sm font-medium truncate">{entry.title}</div>
                  </div>
                  <button
                    onClick={() => handleFavorite(entry.id, entry.favorite)}
                    className={`flex-shrink-0 ${
                      entry.favorite ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-500'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${entry.favorite ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* 用户名 */}
                <div className="col-span-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300 text-sm truncate">{entry.username}</span>
                  <button
                    onClick={() => handleCopy(entry.username)}
                    className="text-gray-400 dark:text-gray-500 hover:text-accent-500 transition-colors flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* 密码 */}
                <div className="col-span-2 flex items-center gap-1">
                  <span className="text-gray-700 dark:text-gray-300 text-sm truncate flex-1">
                    {isPasswordVisible ? entry.password : '••••••••'}
                  </span>
                  <button
                    onClick={() => togglePasswordVisibility(entry.id)}
                    className="text-gray-400 dark:text-gray-500 hover:text-accent-500 transition-colors flex-shrink-0"
                  >
                    {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleCopy(entry.password)}
                    className="text-gray-400 dark:text-gray-500 hover:text-accent-500 transition-colors flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* 网址 */}
                <div className="col-span-2">
                  {entry.url ? (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-500 hover:text-accent-400 text-sm truncate block flex items-center gap-1"
                    >
                      <Globe className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{entry.url}</span>
                    </a>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600 text-sm">-</span>
                  )}
                </div>

                {/* 分类 */}
                <div className="col-span-2">
                  {category ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.icon}
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 text-sm truncate">{category.name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600 text-sm">-</span>
                  )}
                </div>

                {/* 操作 */}
                <div className="col-span-2 flex items-center gap-1">
                  <button
                    onClick={() => onEdit(entry.id)}
                    className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {entry.deleted ? (
                    <button
                      onClick={() => handleRestore(entry.id)}
                      className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-dark-700 rounded transition-colors"
                      title="恢复"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-dark-700 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 分页控制 */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          显示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, entries.length)} / 共 {entries.length} 条
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            上一页
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                    currentPage === pageNum
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            下一页
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="确认删除"
        message="您确定要删除此密码吗？删除后它将进入回收站。"
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setEntryIdToDelete(null);
        }}
      />
    </div>
  );
}

