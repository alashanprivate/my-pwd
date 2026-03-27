import { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import logoUrl from '../assets/logo.png';

interface SecurityQuestion {
  question: string;
  answer: string;
}

// 默认安全问题列表
const DEFAULT_QUESTIONS = [
  "您的第一只宠物叫什么名字？",
  "您在哪个城市出生？",
  "您母亲的娘家姓是什么？",
  "您的小学叫什么名字？",
  "您的第一份工作是什么？",
];

export default function VaultSetup({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [questions, setQuestions] = useState<SecurityQuestion[]>([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);
  const [strength, setStrength] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { createVault, unlockVault } = useStore();

  // 计算密码强度
  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    setStrength(score);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    calculateStrength(value);
  };

  const getStrengthColor = () => {
    if (strength <= 2) return 'bg-red-500';
    if (strength <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (strength <= 2) return '弱';
    if (strength <= 4) return '中';
    return '强';
  };

  const handleQuestionChange = (index: number, field: keyof SecurityQuestion, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  // 验证步骤1
  const validateStep1 = () => {
    if (!password) return '请输入主密码';
    if (password.length < 8) return '密码长度至少需要 8 个字符';
    if (strength < 3) return '密码强度太弱';
    if (password !== confirmPassword) return '两次输入的密码不一致';
    return '';
  };

  // 验证步骤2
  const validateStep2 = () => {
    const filledQuestions = questions.filter(q => q.question && q.answer);
    if (filledQuestions.length < 2) return '请至少设置 2 个安全问题';
    if (questions.some(q => q.question && !q.answer)) return '请为所有选择的问题提供答案';
    return '';
  };

  // 下一步处理
  const handleNext = async () => {
    setError('');
    if (step === 1) {
      const validationError = validateStep1();
      if (validationError) {
        setError(validationError);
        return;
      }
      setStep(2);
    } else {
      const validationError = validateStep2();
      if (validationError) {
        setError(validationError);
        return;
      }
      setIsLoading(true);
      try {
        console.log('[VaultSetup] Creating vault...');
        await createVault(password, questions);
        console.log('[VaultSetup] Vault created, now unlocking...');
        // 自动解锁密钥库并加载数据
        await unlockVault(password);
        console.log('[VaultSetup] Vault unlocked successfully');
        onComplete();
      } catch (err) {
        console.error('[VaultSetup] Error:', err);
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBack = () => {
    setError('');
    setStep(1);
  };

  return (
    <div className="h-full w-full flex justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-white dark:from-dark-950 dark:via-dark-900 dark:to-dark-800 p-4 overflow-y-auto">
      <div className="max-w-md w-full my-auto py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 shadow-lg overflow-hidden">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">创建您的密钥库</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {step === 1 ? '请设置一个安全的主密码' : '设置安全问题以备密码找回'}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-dark-700/50 shadow-2xl">
          {/* 步骤指示器 */}
          <div className="flex items-center justify-center mb-6">
            <div className={`flex items-center ${step >= 1 ? 'text-accent-500' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-accent-500 text-white' : 'bg-gray-200 dark:bg-dark-700'}`}>
                {step > 1 ? <CheckCircle className="w-4 h-4" /> : '1'}
              </div>
              <span className="ml-2 text-sm font-medium">密码</span>
            </div>
            <div className={`w-12 h-0.5 mx-4 ${step >= 2 ? 'bg-accent-500' : 'bg-gray-200 dark:bg-dark-700'}`} />
            <div className={`flex items-center ${step >= 2 ? 'text-accent-500' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-accent-500 text-white' : 'bg-gray-200 dark:bg-dark-700'}`}>
                {step > 2 ? <CheckCircle className="w-4 h-4" /> : '2'}
              </div>
              <span className="ml-2 text-sm font-medium">安全</span>
            </div>
          </div>

          {/* 步骤1：设置密码 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  主密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="请输入您的主密码"
                    className="w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-dark-900/50 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* 密码强度指示器 */}
                {password && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>密码强度</span>
                      <span className={getStrengthLabel() === '强' ? 'text-green-500' : getStrengthLabel() === '中' ? 'text-yellow-500' : 'text-red-500'}>
                        {getStrengthLabel()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                        style={{ width: `${(strength / 6) * 100}%` }}
                      />
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li className={password.length >= 8 ? 'text-green-500' : ''}>• 至少 8 个字符</li>
                      <li className={/[A-Z]/.test(password) ? 'text-green-500' : ''}>• 大写字母</li>
                      <li className={/[a-z]/.test(password) ? 'text-green-500' : ''}>• 小写字母</li>
                      <li className={/[0-9]/.test(password) ? 'text-green-500' : ''}>• 数字</li>
                      <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-500' : ''}>• 特殊字符</li>
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  确认密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入主密码"
                    className={`w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-dark-900/50 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent ${
                      confirmPassword && (password === confirmPassword ? 'border-green-500/50' : 'border-red-500/50')
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 步骤2：安全问题 */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                设置安全问题，以便在忘记密码时找回您的密钥库。
              </p>

              {questions.map((q, index) => (
                <div key={index} className="space-y-3 p-4 bg-gray-100 dark:bg-dark-900/30 rounded-lg border border-gray-200 dark:border-dark-700/30">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      安全问题 {index + 1}
                    </label>
                    <select
                      value={q.question}
                      onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-dark-900/50 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <option value="">请选择问题...</option>
                      {DEFAULT_QUESTIONS.map((question, i) => (
                        <option key={i} value={question}>{question}</option>
                      ))}
                    </select>
                  </div>

                  {q.question && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        您的答案
                      </label>
                      <input
                        type="text"
                        value={q.answer}
                        onChange={(e) => handleQuestionChange(index, 'answer', e.target.value)}
                        placeholder="请输入您的答案"
                        className="w-full px-3 py-2 bg-white dark:bg-dark-900/50 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 错误消息 */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* 导航按钮 */}
          <div className="flex gap-3 mt-6">
            {step === 2 && (
              <button
                onClick={handleBack}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
              返回
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-gray-300 dark:disabled:bg-dark-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{step === 1 ? '处理中...' : '创建中...'}</span>
                </>
              ) : (
                <>
                  {step === 1 ? '继续' : '创建密钥库'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
