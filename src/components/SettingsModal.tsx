import { useState } from 'react';
import { X, Shield, Palette, Download, Upload, RotateCcw, Trash2, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { invoke } from '@tauri-apps/api/tauri';

interface SettingsModalProps {
  onClose: () => void;
}

type Tab = 'security' | 'appearance' | 'data';

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { importData, exportData, theme, setTheme, autoLockInterval, setAutoLockInterval } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('security');
  const [importFile, setImportFile] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  // 安全子页面状态
  const [securityView, setSecurityView] = useState<'main' | 'change-password' | 'update-questions'>('main');

  // 修改密码表单
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdStrength, setPwdStrength] = useState(0);

  // 更新密保表单
  const [questionAuthStep, setQuestionAuthStep] = useState<'auth' | 'form'>('auth');
  const [questions, setQuestions] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  // 清除数据验证状态
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [clearPassword, setClearPassword] = useState('');

  // 计算密强
  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    setPwdStrength(score);
  };

  const handleNewPasswordChange = (val: string) => {
    setNewPassword(val);
    calculateStrength(val);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) return setError('请输入当前密码');
    if (newPassword.length < 8) return setError('新密码长度至少需要 8 个字符');
    if (pwdStrength < 3) return setError('新密码强度太弱');
    if (newPassword !== confirmPassword) return setError('两次输入的新密码不一致');

    setIsLoading(true);
    setError('');
    try {
      await invoke('change_password', { currentPassword, newPassword });
      setSuccess('主密码修改成功');
      setSecurityView('main');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdStrength(0);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuestions = async () => {
    const filledQuestions = questions.filter(q => q.question && q.answer);
    if (filledQuestions.length < 2) return setError('请至少设置 2 个安全问题');
    if (questions.some(q => q.question && !q.answer)) return setError('请为所有选择的问题提供答案');

    setIsLoading(true);
    setError('');
    try {
      await invoke('update_security_questions', { password: currentPassword, questions: filledQuestions });
      setSuccess('安全问题更新成功');
      setSecurityView('main');
      setCurrentPassword('');
      setQuestions([
        { question: '', answer: '' },
        { question: '', answer: '' },
        { question: '', answer: '' },
      ]);
      setQuestionAuthStep('auth');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message);
    } finally {
      setIsLoading(false);
    }
  };


  // 导出数据处理
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const data = await exportData(format);
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `passwords-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('导出成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // 导入数据处理
  const handleImport = async () => {
    if (!importFile || importFile.trim().length === 0) {
      setError('请提供要导入的数据');
      return;
    }

    setIsImporting(true);
    setError('');
    setSuccess('');

    try {
      const format = importFile.trim().startsWith('{') ? 'json' : 'csv';
      console.log('[SettingsModal] Starting import, format:', format);
      console.log('[SettingsModal] Data length:', importFile.length);

      await importData(importFile, format);

      console.log('[SettingsModal] Import successful');
      setSuccess('导入成功！数据已合并到您的密钥库');
      setTimeout(() => setSuccess(''), 3000);
      setImportFile('');
    } catch (err) {
      console.error('[SettingsModal] Import failed:', err);
      const errorMessage = (err as Error).message;
      setError(errorMessage || '导入失败，请检查数据格式');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-dark-700 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">设置</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'security'
                ? 'text-accent-500 border-b-2 border-accent-500 bg-gray-100 dark:bg-dark-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            安全
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'appearance'
                ? 'text-accent-500 border-b-2 border-accent-500 bg-gray-100 dark:bg-dark-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4 inline mr-2" />
            外观
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'data'
                ? 'text-accent-500 border-b-2 border-accent-500 bg-gray-100 dark:bg-dark-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            数据
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto scrollbar-thin p-6">
          {/* 安全标签页 */}
          {activeTab === 'security' && securityView === 'main' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">安全设置</h3>
                <div className="p-4 bg-gray-100 dark:bg-dark-900/30 rounded-lg border border-gray-200 dark:border-dark-700/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    您的密钥库使用 Argon2id 和 ChaCha20-Poly1305 加密，提供军事级安全保护。
                  </p>
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    密钥库已受保护
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">修改主密码</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  修改主密码将使用新密码重新加密您的整个密钥库。
                </p>
                <button
                  onClick={() => {
                    setError('');
                    setSecurityView('change-password');
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-900 dark:text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  修改密码
                </button>
              </div>

              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">安全问题</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  查看或更新用于密码恢复的安全问题。
                </p>
                <button
                  onClick={() => {
                    setError('');
                    setQuestionAuthStep('auth');
                    setSecurityView('update-questions');
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-900 dark:text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  更新问题
                </button>
              </div>

              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">自动锁屏</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  当应用处于非活动状态超过设定时间后自动锁定。
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={autoLockInterval}
                      onChange={(e) => setAutoLockInterval(parseInt(e.target.value, 10))}
                      className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500 appearance-none cursor-pointer"
                    >
                      <option value={0}>从不自动锁定</option>
                      <option value={1}>1 分钟</option>
                      <option value={5}>5 分钟</option>
                      <option value={10}>10 分钟</option>
                      <option value={30}>30 分钟</option>
                      <option value={60}>1 小时</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 修改密码面板 */}
          {activeTab === 'security' && securityView === 'change-password' && (
            <div className="space-y-4 max-w-md">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setSecurityView('main')} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                  ← 返回
                </button>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">修改主密码</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">当前主密码</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">新主密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => handleNewPasswordChange(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-gray-900 dark:text-white"
                />
                {newPassword && (
                  <div className="mt-2 flex gap-1 h-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`flex-1 rounded-full ${
                          pwdStrength >= level
                            ? pwdStrength <= 2
                              ? 'bg-red-500'
                              : pwdStrength <= 3
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                            : 'bg-gray-200 dark:bg-dark-700'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">确认新密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  onClick={() => setSecurityView('main')}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isLoading}
                  className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg disabled:opacity-50"
                >
                  {isLoading ? '修改中...' : '确认修改'}
                </button>
              </div>
            </div>
          )}

          {/* 更新密保问题面板 */}
          {activeTab === 'security' && securityView === 'update-questions' && (
            <div className="space-y-4 max-w-lg">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setSecurityView('main')} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                  ← 返回
                </button>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">更新密保问题</h3>
              </div>

              {questionAuthStep === 'auth' ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    在更新安全问题之前，我们需要验证您的身份。请输入您当前的主密码。
                  </p>
                  <div>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="当前主密码"
                      className="w-full px-4 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => {
                        if (!currentPassword) return setError('请输入当前密码');
                        setError('');
                        setQuestionAuthStep('form');
                      }}
                      className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg"
                    >
                      验证并继续
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    请设置至少 2 个安全问题。这些问题及答案将用于恢复金库，请务必牢记（答案区分大小写）。
                  </p>
                  
                  {questions.map((q, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-gray-200 dark:border-dark-700/50 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">问题 {idx + 1}</label>
                        <input
                          type="text"
                          value={q.question}
                          placeholder="例如: 我母亲的娘家姓什么？"
                          onChange={(e) => {
                            const newQ = [...questions];
                            newQ[idx].question = e.target.value;
                            setQuestions(newQ);
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={q.answer}
                          placeholder="答案"
                          onChange={(e) => {
                            const newQ = [...questions];
                            newQ[idx].answer = e.target.value;
                            setQuestions(newQ);
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="pt-4 flex justify-end gap-3 border-t border-gray-200 dark:border-dark-700 mt-4">
                    <button
                      onClick={() => {
                        setSecurityView('main');
                        setQuestionAuthStep('auth');
                      }}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleUpdateQuestions}
                      disabled={isLoading}
                      className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg disabled:opacity-50"
                    >
                      {isLoading ? '保存中...' : '保存更新'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 外观标签页 */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">主题模式</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  选择您喜欢的界面主题
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {/* 暗色模式 */}
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === 'dark'
                        ? 'bg-accent-500/20 border-accent-500'
                        : 'bg-gray-100 dark:bg-dark-900/30 border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-900 dark:bg-dark-950 rounded-lg border border-gray-300 dark:border-dark-700 flex items-center justify-center">
                        <span className="text-xl">🌙</span>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-900 dark:text-white font-medium text-sm">暗色</p>
                        <p className="text-xs text-gray-500">护眼模式</p>
                      </div>
                      {theme === 'dark' && (
                        <div className="w-4 h-4 rounded-full bg-accent-500 mt-1" />
                      )}
                    </div>
                  </button>

                  {/* 浅色模式 */}
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === 'light'
                        ? 'bg-accent-500/20 border-accent-500'
                        : 'bg-gray-100 dark:bg-dark-900/30 border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-white dark:bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center">
                        <span className="text-xl">☀️</span>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-900 dark:text-white font-medium text-sm">浅色</p>
                        <p className="text-xs text-gray-500">明亮模式</p>
                      </div>
                      {theme === 'light' && (
                        <div className="w-4 h-4 rounded-full bg-accent-500 mt-1" />
                      )}
                    </div>
                  </button>

                  {/* 跟随系统 */}
                  <button
                    onClick={() => setTheme('system')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === 'system'
                        ? 'bg-accent-500/20 border-accent-500'
                        : 'bg-gray-100 dark:bg-dark-900/30 border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-gray-100 dark:from-dark-950 dark:to-gray-100 rounded-lg border border-gray-300 dark:border-dark-700 flex items-center justify-center">
                        <span className="text-xl">💻</span>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-900 dark:text-white font-medium text-sm">跟随系统</p>
                        <p className="text-xs text-gray-500">自动切换</p>
                      </div>
                      {theme === 'system' && (
                        <div className="w-4 h-4 rounded-full bg-accent-500 mt-1" />
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 数据标签页 */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">导出数据</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  将您的密码数据导出为 JSON 或 CSV 文件，用于备份或迁移。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('json')}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-900 dark:text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    导出为 JSON
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-900 dark:text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    导出为 CSV
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">导入数据</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  从 JSON 或 CSV 文件导入密码数据。这将与现有数据合并。
                </p>
                <textarea
                  value={importFile}
                  onChange={(e) => setImportFile(e.target.value)}
                  placeholder="在此粘贴 JSON 或 CSV 数据..."
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
                />
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="mt-2 w-full px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:bg-gray-300 dark:disabled:bg-dark-700 disabled:text-gray-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>导入中...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      导入数据
                    </>
                  )}
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
                <h3 className="text-lg font-medium text-red-500 mb-4">危险区域</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  清除密钥库中的所有数据。此操作无法撤销。
                </p>
                
                {!isConfirmingClear ? (
                  <button
                    onClick={() => setIsConfirmingClear(true)}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    清除所有数据
                  </button>
                ) : (
                  <div className="space-y-3 max-w-sm">
                    <p className="text-sm font-medium text-red-500">请输入主密码确认：</p>
                    <input
                      type="password"
                      value={clearPassword}
                      onChange={(e) => setClearPassword(e.target.value)}
                      placeholder="您的主密码"
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setIsConfirmingClear(false);
                          setClearPassword('');
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-900 dark:text-white rounded-lg text-sm transition-colors"
                      >
                        取消
                      </button>
                      <button
                        disabled={!clearPassword || isLoading}
                        onClick={async () => {
                          setIsLoading(true);
                          setError('');
                          try {
                            await invoke('clear_all_data', { password: clearPassword });
                            setSuccess('所有数据已清除');
                            setTimeout(() => {
                              window.location.reload();
                            }, 1000);
                          } catch (err: any) {
                            setError(typeof err === 'string' ? err : err.message);
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        {isLoading ? '处理中...' : '确认清除'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
          >
            关闭
          </button>
        </div>

        {/* 错误/成功消息 */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="absolute bottom-4 left-4 right-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
