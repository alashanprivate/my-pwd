import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function useThemeEffect() {
  const { theme } = useStore();

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // 应用主题（同时操作 html 和 body）
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        root.classList.add('dark');
        body?.classList.add('dark');
      } else {
        root.classList.remove('dark');
        body?.classList.remove('dark');
      }
    };

    applyTheme();

    // 监听系统主题变化
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add('dark');
          body?.classList.add('dark');
        } else {
          root.classList.remove('dark');
          body?.classList.remove('dark');
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, [theme]);
}
