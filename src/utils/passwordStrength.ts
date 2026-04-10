/**
 * 密码强度等级
 */
export type StrengthLevel = 'weak' | 'medium' | 'strong';

/**
 * 密码强度评估结果
 */
export interface StrengthResult {
  /** 0~6 分，分数越高越强 */
  score: number;
  /** 强度等级 */
  level: StrengthLevel;
  /** 中文描述 */
  label: string;
}

/**
 * 计算密码强度
 * @param password 待评估密码
 * @returns 强度评估结果
 */
export function calculatePasswordStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const level: StrengthLevel = score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';
  const labels: Record<StrengthLevel, string> = {
    weak: '弱',
    medium: '中',
    strong: '强',
  };

  return { score, level, label: labels[level] };
}

/** 强度等级对应的颜色类名 */
export const strengthColors: Record<StrengthLevel, string> = {
  weak: 'bg-red-500',
  medium: 'bg-yellow-500',
  strong: 'bg-green-500',
};

/** 强度等级对应的文字颜色类名 */
export const strengthTextColors: Record<StrengthLevel, string> = {
  weak: 'text-red-500',
  medium: 'text-yellow-500',
  strong: 'text-green-500',
};
