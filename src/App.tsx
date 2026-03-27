import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useStore } from './store/useStore';
import VaultSetup from './components/VaultSetup';
import VaultLockScreen from './components/VaultLockScreen';
import MainLayout from './components/MainLayout';
import ForgotPasswordFlow from './components/ForgotPasswordFlow';
import TitleBar from './components/TitleBar';
import { listen } from '@tauri-apps/api/event';

type View = 'setup' | 'lock' | 'main' | 'forgot';

function App() {
  const { isSetup: _isSetup, isUnlocked, setSetup, setUnlocked, lockVault, setError, autoLockInterval } = useStore();
  const [currentView, setCurrentView] = React.useState<View>('lock');

  // 主题由 useStore 初始化时自动应用，此处不再重复处理
  useEffect(() => {
    // Check if vault exists and try to restore session
    const checkVault = async () => {
      try {
        const setup = await invoke<boolean>('check_vault_setup');
        setSetup(setup);

        if (setup) {
          setCurrentView('lock');
        } else {
          setCurrentView('setup');
        }
      } catch (error) {
        setError((error as Error).message);
      }
    };

    checkVault();

    // Listen for lock events
    const unlisten = listen('vault-locked', () => {
      setUnlocked(false);
      setCurrentView('lock');
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [setSetup, setUnlocked, setError]);

  // 自动锁屏逻辑
  useEffect(() => {
    if (!isUnlocked || autoLockInterval === 0) return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        console.log('[AutoLock] Idle timeout reached, locking vault...');
        handleLock();
      }, autoLockInterval * 60 * 1000);
    };

    // 监听各类用户活动
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // 初始化计时器
    resetTimer();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isUnlocked, autoLockInterval]);


  const handleLock = () => {
    lockVault();
    setCurrentView('lock');
  };

  // 根据当前视图渲染内容
  const renderContent = () => {
    if (currentView === 'setup') {
      return <VaultSetup onComplete={() => setCurrentView('main')} />;
    }
    if (currentView === 'lock') {
      return <VaultLockScreen onUnlock={() => setCurrentView('main')} onForgot={() => setCurrentView('forgot')} />;
    }
    if (currentView === 'forgot') {
      return <ForgotPasswordFlow onComplete={() => setCurrentView('lock')} onCancel={() => setCurrentView('lock')} />;
    }
    if (currentView === 'main' && isUnlocked) {
      return <MainLayout onLock={handleLock} />;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* 自定义标题栏 - 始终在最顶部 */}
      <TitleBar />
      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
