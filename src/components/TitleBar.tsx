import { useState } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { appWindow } from '@tauri-apps/api/window';

/**
 * 自定义窗口标题栏组件
 * 替代原生窗口装饰，跟随主题切换
 */
export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  // 开始拖拽窗口
  const handleMouseDown = async (e: React.MouseEvent) => {
    // 只有在非按钮区域才触发拖拽
    if ((e.target as HTMLElement).closest('button')) return;
    await appWindow.startDragging();
  };

  // 最小化
  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  // 最大化/还原
  const handleMaximize = async () => {
    const maximized = await appWindow.isMaximized();
    if (maximized) {
      await appWindow.unmaximize();
      setIsMaximized(false);
    } else {
      await appWindow.maximize();
      setIsMaximized(true);
    }
  };

  // 关闭
  const handleClose = async () => {
    await appWindow.close();
  };

  // 双击标题栏切换最大化/还原
  const handleDoubleClick = async () => {
    await handleMaximize();
  };

  return (
    <div
      className="h-8 flex items-center justify-between select-none bg-gray-100 dark:bg-dark-950 border-b border-gray-200 dark:border-dark-800 transition-colors"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* 应用标题 */}
      <div className="flex items-center pl-3 gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          My Password Manager
        </span>
      </div>

      {/* 窗口控制按钮 */}
      <div className="flex h-full">
        {/* 最小化 */}
        <button
          onClick={handleMinimize}
          className="h-full px-3 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-800 transition-colors"
          title="最小化"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* 最大化/还原 */}
        <button
          onClick={handleMaximize}
          className="h-full px-3 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-800 transition-colors"
          title={isMaximized ? '向下还原' : '最大化'}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        {/* 关闭 */}
        <button
          onClick={handleClose}
          className="h-full px-3 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white transition-colors"
          title="关闭"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
