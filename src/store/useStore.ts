import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

export interface Entry {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category_id: string;
  favorite: boolean;
  created_at: number;
  updated_at: number;
  deleted: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at: number;
}

export interface VaultState {
  isSetup: boolean;
  isUnlocked: boolean;
  vaultId: string;
  entries: Entry[];
  categories: Category[];
  currentView: 'all' | 'favorites' | 'trash' | 'category' | 'categories';
  selectedCategory: string | null;
  searchQuery: string;
  searchCategory: string | null;
  error: string | null;
  theme: 'light' | 'dark' | 'system';
  autoLockInterval: number; // 分钟，0 表示从不


  setSetup: (setup: boolean) => void;
  setUnlocked: (unlocked: boolean) => void;
  setVaultId: (id: string) => void;
  setEntries: (entries: Entry[]) => void;
  setCategories: (categories: Category[]) => void;
  setCurrentView: (view: 'all' | 'favorites' | 'trash' | 'category' | 'categories') => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSearchCategory: (categoryId: string | null) => void;
  setError: (error: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setAutoLockInterval: (interval: number) => void;


  // Actions
  createVault: (password: string, securityQuestions: Array<{question: string; answer: string}>) => Promise<void>;
  unlockVault: (password: string) => Promise<void>;
  lockVault: () => void;
  addEntry: (entry: Omit<Entry, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateEntry: (id: string, entry: Partial<Entry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  restoreEntry: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'created_at'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  getCategoryEntryCount: (categoryId: string) => number;
  exportData: (format: 'json' | 'csv') => Promise<string>;
  importData: (data: string, format: 'json' | 'csv') => Promise<void>;
}

export const useStore = create<VaultState>((set, get) => {
  // 获取存储的主题，默认为 'dark'
  const getStoredTheme = (): 'light' | 'dark' | 'system' => {
    if (typeof localStorage === 'undefined') return 'dark';
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'dark';
  };

  const getStoredAutoLockInterval = (): number => {
    if (typeof localStorage === 'undefined') return 5;
    const stored = localStorage.getItem('autoLockInterval');
    return stored ? parseInt(stored, 10) : 5;
  };


  // 应用主题到 DOM（同时操作 html 和 body，确保 TailwindCSS dark: 变体正确生效）
  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    const body = document.body;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
      body?.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body?.classList.remove('dark');
    }
  };

  // 初始化主题
  const initialTheme = getStoredTheme();
  const initialAutoLockInterval = getStoredAutoLockInterval();
  applyTheme(initialTheme);


  return {
    isSetup: false,
    isUnlocked: false,
    vaultId: '',
    entries: [],
    categories: [],
    currentView: 'all',
    selectedCategory: null,
    searchQuery: '',
    searchCategory: null,
    error: null,
    theme: initialTheme,
    autoLockInterval: initialAutoLockInterval,


    setSetup: (setup) => set({ isSetup: setup }),
    setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
    setVaultId: (id) => set({ vaultId: id }),
    setEntries: (entries) => set({ entries }),
    setCategories: (categories) => set({ categories }),
    setCurrentView: (view) => set({ currentView: view }),
    setSelectedCategory: (categoryId) => set({ selectedCategory: categoryId }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchCategory: (categoryId) => set({ searchCategory: categoryId }),
    setError: (error) => set({ error }),
    setTheme: (theme) => {
      console.log('[setTheme] Setting to:', theme, '| localStorage:', localStorage.getItem('theme'));
      localStorage.setItem('theme', theme);
      applyTheme(theme);
      set({ theme });
      console.log('[setTheme] Done, state now:', get().theme);
    },

    setAutoLockInterval: (interval) => {
      localStorage.setItem('autoLockInterval', interval.toString());
      set({ autoLockInterval: interval });
    },


    createVault: async (password, securityQuestions) => {
      try {
        await invoke('create_vault', { password, securityQuestions });
        set({ isSetup: true, isUnlocked: true });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },

    unlockVault: async (password) => {
      try {
        const vaultId = await invoke<string>('unlock_vault', { password });
        const entries = await invoke<Entry[]>('list_entries', {});
        const categories = await invoke<Category[]>('list_categories', {});
        set({ isUnlocked: true, vaultId, entries, categories });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },

    lockVault: () => {
      invoke('lock_vault');
      set({ isUnlocked: false, vaultId: '', entries: [] });
    },

    addEntry: async (entry) => {
      try {
        const id = await invoke<string>('create_entry', { entry });
        const newEntry: Entry = { ...entry, id, created_at: Date.now(), updated_at: Date.now() };
        set({ entries: [...get().entries, newEntry] });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },

    updateEntry: async (id, entry) => {
      try {
        await invoke('update_entry', { id, entry });
        set({
          entries: get().entries.map((e) =>
            e.id === id ? { ...e, ...entry, updated_at: Date.now() } : e
          ),
        });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },

    deleteEntry: async (id) => {
      try {
        await invoke('delete_entry', { id });
        set({
          entries: get().entries.map((e) =>
            e.id === id ? { ...e, deleted: true } : e
          ),
        });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },

    restoreEntry: async (id) => {
      try {
        await invoke('restore_entry', { id });
        set({
          entries: get().entries.map((e) =>
            e.id === id ? { ...e, deleted: false } : e
          ),
        });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },

    addCategory: async (category) => {
      try {
        const id = await invoke<string>('create_category', { category });
        const newCategory: Category = { ...category, id, created_at: Date.now() };
        set({ categories: [...get().categories, newCategory] });
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage === 'Vault not unlocked') {
          // Session expired, clear unlock state
          set({ isUnlocked: false, error: '会话已过期，请重新解锁' });
        } else {
          set({ error: errorMessage });
        }
        throw error;
      }
    },

    updateCategory: async (id, category) => {
      try {
        await invoke('update_category', { id, category });
        set({
          categories: get().categories.map((c) =>
            c.id === id ? { ...c, ...category } : c
          ),
        });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },

    deleteCategory: async (id) => {
      try {
        await invoke('delete_category', { id });
        set({ categories: get().categories.filter((c) => c.id !== id) });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },

    getCategoryEntryCount: (categoryId) => {
      return get().entries.filter(e => e.category_id === categoryId && !e.deleted).length;
    },

    exportData: async (format) => {
      return await invoke<string>('export_data', { format });
    },

    importData: async (data, format) => {
      try {
        await invoke('import_data', { data, format });
        const entries = await invoke<Entry[]>('list_entries', {});
        const categories = await invoke<Category[]>('list_categories', {});
        set({ entries, categories });
      } catch (error) {
        set({ error: (error as Error).message });
        throw error;
      }
    },
  };
});
