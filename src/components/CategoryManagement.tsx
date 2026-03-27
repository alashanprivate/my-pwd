import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, FolderOpen, Lock, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useStore, Category } from '../store/useStore';
import CategoryModal from './CategoryModal';
import ConfirmModal from './ConfirmModal';

const ITEMS_PER_PAGE = 10;

export default function CategoryManagement({ searchQuery }: { searchQuery: string }) {
  const { categories, addCategory, updateCategory, deleteCategory, getCategoryEntryCount, isUnlocked } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // 删除确认状态
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');

  // 搜索和分页过滤
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.icon.includes(query)
    );
  }, [categories, searchQuery]);

  const totalPages = Math.ceil(filteredCategories.length / ITEMS_PER_PAGE);
  const paginatedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredCategories.slice(startIndex, endIndex);
  }, [filteredCategories, currentPage]);

  // 重置到第一页当数据变化时
  useMemo(() => {
    setCurrentPage(1);
  }, [filteredCategories.length]);

  // 检查是否已解锁
  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lock className="w-16 h-16 bg-gray-100 dark:bg-dark-800 rounded-full flex items-center justify-center mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">请先解锁密钥库</h3>
        <p className="text-gray-500">分类管理需要解锁后才能使用</p>
      </div>
    );
  }

  const getCategoryCount = (categoryId: string) => {
    return getCategoryEntryCount(categoryId);
  };

  const handleAdd = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
    setError('');
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
    setError('');
  };

  const handleSave = async (data: { name: string; icon: string; color: string }) => {
    if (editingCategory) {
      await updateCategory(editingCategory.id, data);
    } else {
      await addCategory(data);
    }
    setError('');
  };

  const handleDelete = async (category: Category) => {
    const count = getCategoryCount(category.id);
    if (count > 0) {
      setError(`无法删除：该分类下还有 ${count} 个密码`);
      return;
    }

    setCategoryToDelete(category);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (categoryToDelete) {
      try {
        await deleteCategory(categoryToDelete.id);
        setError('');
        setCategoryToDelete(null);
      } catch (err) {
        setError((err as Error).message);
      }
    }
  };


  if (filteredCategories.length === 0 && !isModalOpen) {
    return (
      <div className="space-y-4">
        {/* 添加分类按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加分类
          </button>
        </div>

        {/* 空状态 */}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-dark-800 rounded-full flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无分类</h3>
          <p className="text-gray-500">
            {searchQuery ? '没有找到匹配的分类' : '点击右上角按钮添加分类'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 错误消息 */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 添加分类按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加分类
        </button>
      </div>

      {/* 表格 */}
      <div className="bg-gray-50 dark:bg-dark-800/50 border border-gray-200 dark:border-dark-700/50 rounded-lg overflow-hidden">
        {/* 表头 */}
        <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-gray-100 dark:bg-dark-900/50 border-b border-gray-200 dark:border-dark-700 text-sm font-medium text-gray-600 dark:text-gray-400">
          <div className="col-span-1 w-8 text-center">#</div>
          <div className="col-span-1">图标</div>
          <div className="col-span-1">分类名称</div>
          <div className="col-span-1">密码数量</div>
          <div className="col-span-1">操作</div>
        </div>

        {/* 表格内容 */}
        <div className="divide-y divide-gray-200 dark:divide-dark-700/50">
          {paginatedCategories.map((category, index) => {
            const entryCount = getCategoryCount(category.id);
            const rowNum = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

            return (
              <div
                key={category.id}
                className="grid grid-cols-5 gap-4 px-6 py-3 hover:bg-gray-100 dark:hover:bg-dark-700/30 transition-colors items-center"
              >
                {/* 行号 */}
                <div className="col-span-1 w-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  {rowNum}
                </div>

                {/* 图标 */}
                <div className="col-span-1">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.icon}
                  </div>
                </div>

                {/* 分类名称 */}
                <div className="col-span-1">
                  <span className="text-gray-900 dark:text-white text-sm font-medium">{category.name}</span>
                </div>

                {/* 密码数量 */}
                <div className="col-span-1">
                  <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300 text-sm">
                    <User className="w-4 h-4" />
                    <span>{entryCount} 个</span>
                  </div>
                </div>

                {/* 操作 */}
                <div className="col-span-1 flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      entryCount > 0
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/10'
                    }`}
                    title={entryCount > 0 ? '该分类下还有密码，无法删除' : '删除'}
                    disabled={entryCount > 0}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 分页控制 */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          显示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCategories.length)} / 共 {filteredCategories.length} 条
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
        title="删除分类"
        message={`确定要删除分类 "${categoryToDelete?.name}" 吗？此操作无法撤销。`}
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCategoryToDelete(null);
        }}
      />

      {/* 分类弹窗 */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingCategory ? {
          name: editingCategory.name,
          icon: editingCategory.icon,
          color: editingCategory.color,
        } : undefined}
        title={editingCategory ? '编辑分类' : '添加分类'}
      />
    </div>
  );
}
