import { useState } from 'react';
import { AlertCircle, CheckCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';

interface SecurityQuestion {
  question: string;
  answer: string;
}

export default function ForgotPasswordFlow({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<'verify' | 'questions' | 'reset' | 'success'>('verify');
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 获取安全问题
  const fetchSecurityQuestions = async () => {
    try {
      setIsLoading(true);
      const questions = await invoke<SecurityQuestion[]>('get_security_questions');
      setSecurityQuestions(questions);
      setStep('questions');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // 提交回答
  const handleAnswerSubmit = () => {
    setError('');
    const currentAnswer = answers[currentQuestionIndex];

    if (!currentAnswer || currentAnswer.trim().length === 0) {
      setError('请提供答案');
      return;
    }

    if (currentQuestionIndex < securityQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // 所有回答已提供，验证答案
      verifyAnswers();
    }
  };

  // 验证安全问题答案
  const verifyAnswers = async () => {
    try {
      setIsLoading(true);
      await invoke('verify_security_answers', { answers });
      setStep('reset');
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : (err as Error).message;
      if (errorMsg.includes('Legacy vault')) {
        setError(errorMsg);
      } else {
        setError('一个或多个答案不正确，请重试');
      }
      setCurrentQuestionIndex(0);
      setAnswers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 重置密码
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('密码长度至少需要 8 个字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    try {
      setIsLoading(true);
      await invoke('reset_password', { newPassword });
      setStep('success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-white dark:from-dark-950 dark:via-dark-900 dark:to-dark-800 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-500/10 mb-4">
            <RotateCcw className="w-8 h-8 text-accent-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">恢复密钥库</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {step === 'verify' && '验证您的身份以重置密码'}
            {step === 'questions' && `回答安全问题 ${currentQuestionIndex + 1} / ${securityQuestions.length}`}
            {step === 'reset' && '创建新的主密码'}
            {step === 'success' && '密码重置成功'}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-dark-700/50 shadow-2xl">
          {/* 步骤1：验证 */}
          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                要重置密码，您需要回答安全问题。
                这是为了保护您的密钥库而采取的安全措施。
              </p>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-500">
                    警告：请确保您在安全的地方。多次错误回答安全问题可能会锁定您的账户。
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={fetchSecurityQuestions}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-gray-300 dark:disabled:bg-dark-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" />
                      加载中...
                    </>
                  ) : (
                    '继续'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 步骤2：回答安全问题 */}
          {step === 'questions' && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-100 dark:bg-dark-900/30 rounded-lg border border-gray-200 dark:border-dark-700/30">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  安全问题 {currentQuestionIndex + 1} / {securityQuestions.length}:
                </p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {securityQuestions[currentQuestionIndex]?.question}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  您的答案
                </label>
                <input
                  type="text"
                  value={answers[currentQuestionIndex] || ''}
                  onChange={(e) => {
                    const newAnswers = [...answers];
                    newAnswers[currentQuestionIndex] = e.target.value;
                    setAnswers(newAnswers);
                  }}
                  placeholder="请输入您的答案"
                  autoFocus
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900/50 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              {/* 进度指示器 */}
              <div className="flex gap-1">
                {securityQuestions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < currentQuestionIndex ? 'bg-green-500' :
                      i === currentQuestionIndex ? 'bg-accent-500' :
                      'bg-gray-200 dark:bg-dark-700'
                    }`}
                  />
                ))}
              </div>

              {/* 错误消息 */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (currentQuestionIndex > 0) {
                      setCurrentQuestionIndex(currentQuestionIndex - 1);
                    } else {
                      onCancel();
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {currentQuestionIndex > 0 ? '上一步' : '取消'}
                </button>
                <button
                  onClick={handleAnswerSubmit}
                  disabled={isLoading || !answers[currentQuestionIndex]}
                  className="flex-1 px-4 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-gray-300 dark:disabled:bg-dark-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {currentQuestionIndex < securityQuestions.length - 1 ? '下一步' : '验证'}
                </button>
              </div>
            </div>
          )}

          {/* 步骤3：重置密码 */}
          {step === 'reset' && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  新主密码
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                  minLength={8}
                  required
                  autoFocus
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900/50 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  确认新密码
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  minLength={8}
                  required
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-900/50 border border-gray-300 dark:border-dark-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              {/* 错误消息 */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="flex-1 px-4 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-gray-300 dark:disabled:bg-dark-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {isLoading ? '重置中...' : '重置密码'}
                </button>
              </div>
            </form>
          )}

          {/* 步骤4：成功 */}
          {step === 'success' && (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-lg text-gray-900 dark:text-white font-medium">密码重置成功！</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                您的主密码已重置，现在可以使用新密码解锁密钥库了。
              </p>

              <button
                onClick={handleComplete}
                className="w-full px-4 py-3 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors"
              >
                继续登录
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
