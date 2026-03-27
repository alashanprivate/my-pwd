import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface CategoryFormData {
  name: string;
  icon: string;
  color: string;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CategoryFormData) => Promise<void>;
  initialData?: CategoryFormData;
  title: string;
}

// 可选颜色列表
const COLORS = [
  '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#6b7280',
];

// 可选图标列表
const ICONS = [
  // 文件与文件夹
  '📁', '📂', '📄', '📃', '📋', '📑', '📰', '🗞️',
  // 工作与办公
  '💼', '🏢', '🏦', '💻', '⌨️', '🖥️', '💾', '💿',
  // 社交与通讯
  '👥', '👤', '📧', '✉️', '📞', '📱', '💬', '📷',
  // 购物与金融
  '🛒', '💰', '💳', '💎', '🏪', '🏬', '🛍️', '💵',
  // 学习与教育
  '📚', '✏️', '🎓', '📖', '📝', '🔬', '🎨', '🎭',
  // 生活与娱乐
  '🎮', '🎬', '🎵', '⚽', '🏀', '🎯', '🎲', '🃏',
  // 网络与技术
  '🌐', '🔗', '🔒', '🔑', '🔓', '🛡️', '⚙️', '🔧',
  // 其他常用符号
  '⭐', '❤️', '🔥', '✨', '🚀', '🎉', '📍', '🏠',
];

export default function CategoryModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title,
}: CategoryModalProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    icon: '📁',
    color: COLORS[0],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: '',
        icon: '📁',
        color: COLORS[0],
      });
    }
    setIconSearch('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // 保存分类
  const handleSave = async () => {
    if (!formData.name.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error('Failed to save category:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 图标搜索过滤
  const filteredIcons = iconSearch
    ? ICONS.filter(icon => icon.includes(iconSearch) || ICONS.indexOf(icon).toString().includes(iconSearch))
    : ICONS;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-dark-700 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto scrollbar-thin p-6 space-y-6">
          {/* 分类名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              分类名称
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入分类名称"
              className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleSave();
                }
              }}
            />
          </div>

          {/* 图标选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              选择图标
            </label>
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-dark-800 transition-colors"
            >
              <span className="text-2xl">{formData.icon}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">点击选择图标</span>
            </button>

            {showIconPicker && (
              <div className="mt-2 p-3 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg">
                {/* 图标搜索 */}
                <input
                  type="text"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="搜索图标..."
                  className="w-full px-3 py-2 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 mb-3"
                />

                {/* 图标网格 */}
                <div className="grid grid-cols-10 gap-1 max-h-48 overflow-auto scrollbar-thin">
                  {filteredIcons.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => {
                        setFormData({ ...formData, icon });
                        setShowIconPicker(false);
                        setIconSearch('');
                      }}
                      className={`w-8 h-8 flex items-center justify-center text-lg rounded transition-colors ${
                        formData.icon === icon
                          ? 'bg-accent-500 ring-2 ring-white'
                          : 'hover:bg-gray-200 dark:hover:bg-dark-700'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>

                {filteredIcons.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-4">
                    未找到匹配的图标
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 颜色选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              选择颜色
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-10 h-10 rounded-full ${
                    formData.color === color ? 'ring-2 ring-accent-500 ring-offset-2 ring-offset-white dark:ring-offset-dark-800' : ''
                  } transition-all hover:scale-110`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* 预览 */}
          <div className="p-4 bg-gray-100 dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-700">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              预览
            </label>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                style={{ backgroundColor: formData.color }}
              >
                {formData.icon || '📁'}
              </div>
              <div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {formData.name || '分类名称'}
                </div>
                <div className="text-gray-500 text-sm">
                  {formData.color}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-2">
          <button
            onClick={handleSave}
            disabled={isLoading || !formData.name.trim()}
            className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:bg-gray-300 dark:disabled:bg-dark-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                保存
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 disabled:bg-gray-100 dark:disabled:bg-dark-800 disabled:text-gray-500 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
