import { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff, Globe, User, Lock, FileText, Star } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Category } from '../store/useStore';

interface EntryModalProps {
  entryId: string | null;
  onClose: () => void;
  categories: Category[];
}

interface EntryFormData {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category_id: string;
  favorite: boolean;
  deleted: boolean;
}

export default function EntryModal({ entryId, onClose, categories }: EntryModalProps) {
  const { entries, addEntry, updateEntry } = useStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<EntryFormData>({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    category_id: '',
    favorite: false,
    deleted: false,
  });

  useEffect(() => {
    if (entryId) {
      const entry = entries.find(e => e.id === entryId);
      if (entry) {
        setFormData({
          title: entry.title,
          username: entry.username,
          password: entry.password,
          url: entry.url,
          notes: entry.notes,
          category_id: entry.category_id,
          favorite: entry.favorite,
          deleted: false,
        });
      }
    }
  }, [entryId, entries]);

  // 表单字段变更处理
  const handleChange = (field: keyof EntryFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 表单提交处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.username || !formData.password) {
      setError('请填写所有必填字段');
      return;
    }

    try {
      if (entryId) {
        await updateEntry(entryId, formData);
      } else {
        await addEntry(formData);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // 生成随机密码
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    const array = new Uint32Array(20);
    crypto.getRandomValues(array);

    for (let i = 0; i < 20; i++) {
      password += chars[array[i] % chars.length];
    }

    setFormData(prev => ({ ...prev, password }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto scrollbar-thin border border-gray-200 dark:border-dark-700">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {entryId ? '编辑密码' : '添加新密码'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 错误消息 */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="例如：Gmail、Netflix 等"
              required
              className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              用户名 / 邮箱 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="输入用户名或邮箱"
                required
                className="w-full pl-10 pr-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>

          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              密码 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="输入密码"
                  required
                  className="w-full pl-10 pr-20 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="p-1 text-accent-500 hover:text-accent-400 text-xs font-medium"
                  >
                    生成
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 网站地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              网站地址
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="url"
                value={formData.url}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://example.com"
                className="w-full pl-10 pr-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>

          {/* 分类 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              分类
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => handleChange('category_id', e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="">无分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              备注
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="其他备注..."
                rows={4}
                className="w-full pl-10 pr-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
              />
            </div>
          </div>

          {/* 收藏切换 */}
          <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-dark-900/30 rounded-lg">
            <button
              type="button"
              onClick={() => handleChange('favorite', !formData.favorite)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                formData.favorite ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-200 dark:bg-dark-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Star className={`w-4 h-4 ${formData.favorite ? 'fill-current' : ''}`} />
              <span className="text-sm">标记为收藏</span>
            </button>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {entryId ? '保存更改' : '添加密码'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
