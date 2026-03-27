import { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import logoUrl from '../assets/logo.png';

export default function VaultLockScreen({ onUnlock, onForgot }: { onUnlock: () => void; onForgot: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { unlockVault } = useStore();

  // 解锁密钥库
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await unlockVault(password);
      onUnlock();
    } catch (err) {
      setError((err as Error).message || '解锁失败，请检查您的密码');
    } finally {
      setIsLoading(false);
    }
  };

  // 按回车键提交
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock(e as any);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-white dark:from-dark-950 dark:via-dark-900 dark:to-dark-800 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-6 shadow-xl overflow-hidden hover:scale-105 transition-transform">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">密钥库已锁定</h1>
          <p className="text-gray-500 dark:text-gray-400">请输入主密码解锁</p>
        </div>

        <div className="bg-white/80 dark:bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-dark-700/50 shadow-2xl">
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                主密码
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入您的主密码"
                  disabled={isLoading}
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-dark-900/50 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 错误消息 */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full px-4 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-gray-300 dark:disabled:bg-dark-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>解锁中...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>解锁密钥库</span>
                </>
              )}
            </button>
          </form>

          {/* 忘记密码链接 */}
          <div className="mt-4 text-center">
            <button
              onClick={onForgot}
              className="text-sm text-gray-400 hover:text-accent-500 transition-colors"
            >
              忘记密码？
            </button>
          </div>

          {/* 安全提示 */}
          <div className="mt-6 p-3 bg-gray-100 dark:bg-dark-900/30 rounded-lg border border-gray-200 dark:border-dark-700/30">
            <p className="text-xs text-gray-500 text-center">
              🔒 您的密码使用军事级加密技术保护
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
