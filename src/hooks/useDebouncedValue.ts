import { useState, useEffect } from 'react';

/**
 * 防抖 hook：延迟更新值，避免高频输入触发过多计算
 * @param value 需要防抖的原始值
 * @param delay 延迟毫秒数，默认 200ms
 */
export function useDebouncedValue<T>(value: T, delay: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
