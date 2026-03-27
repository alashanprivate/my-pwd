# My Password Manager

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Rust](https://img.shields.io/badge/rust-1.70+-orange)
![React](https://img.shields.io/badge/react-18.2.0-cyan)

一款基于 Tauri + React + Rust 构建的跨平台密码管理器，提供军事级加密安全保护。

[功能特性](#功能特性) • [快速开始](#快速开始) • [安全机制](#安全机制) • [开发指南](#开发指南)

</div>

---

## 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [使用说明](#使用说明)
- [安全机制](#安全机制)
- [开发指南](#开发指南)
- [数据库架构](#数据库架构)
- [API 参考](#api-参考)
- [常见问题](#常见问题)
- [路线图](#路线图)
- [贡献指南](#贡献指南)
- [许可证](#许可证)
- [致谢](#致谢)

---

## 项目简介

**My Password Manager** 是一款本地优先的跨平台密码管理器，致力于为用户提供安全、简洁、高效的密码存储解决方案。

### 设计理念

- **安全第一**：采用业界领先的加密算法，确保数据安全
- **本地存储**：所有数据存储在本地加密数据库，无需云端同步
- **简洁易用**：现代化暗色 UI 设计，操作直观便捷
- **跨平台**：支持 Windows、macOS、Linux 三大桌面平台

---

## 功能特性

### 🔒 核心安全功能

| 功能 | 描述 |
|------|------|
| **军事级加密** | Argon2id 密钥派生 + ChaCha20-Poly1305 数据加密 |
| **双层密钥架构** | 主密钥（Master Key）+ 数据库密钥（Database Key） |
| **字段级加密** | 所有敏感字段单独加密，随机 Nonce |
| **内存安全** | 使用 Zeroize 自动清理敏感数据 |
| **审计日志** | 记录所有关键操作 |

### 📁 密码管理

| 功能 | 描述 |
|------|------|
| **CRUD 操作** | 创建、查看、编辑、删除密码条目 |
| **分类管理** | 自定义分类，支持图标和颜色 |
| **收藏标记** | 快速访问常用密码 |
| **软删除机制** | 删除后可从回收站恢复 |
| **快速搜索** | 实时搜索所有密码 |

### 💾 数据管理

| 功能 | 描述 |
|------|------|
| **导入导出** | 支持 JSON/CSV 格式 |
| **数据备份** | 定期导出数据备份 |
| **数据迁移** | 轻松迁移到新设备 |

### 🎨 用户界面

| 功能 | 描述 |
|------|------|
| **暗色主题** | 护眼的现代化暗色 UI |
| **响应式设计** | 自适应不同窗口大小 |
| **流畅动画** | 精致的交互动画效果 |

---

## 技术栈

### 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| [React](https://react.dev/) | 18.2.0 | UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | 5.2.2 | 类型安全 |
| [TailwindCSS](https://tailwindcss.com/) | 3.3.6 | CSS 框架 |
| [Zustand](https://zustand-demo.pmnd.rs/) | 4.4.7 | 状态管理 |
| [Lucide React](https://lucide.dev/) | 0.294.0 | 图标库 |
| [Vite](https://vitejs.dev/) | 5.0.8 | 构建工具 |

### 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| [Rust](https://www.rust-lang.org/) | Edition 2021 | 后端语言 |
| [Tauri](https://tauri.app/) | 1.5 | 桌面应用框架 |
| [rusqlite](https://docs.rs/rusqlite/) | 0.30 | SQLite 绑定 |
| [Argon2](https://docs.rs/argon2/) | 0.5 | 密码哈希 |
| [ChaCha20-Poly1305](https://docs.rs/chacha20poly1305/) | 0.10 | AEAD 加密 |
| [Zeroize](https://docs.rs/zeroize/) | 1.6 | 内存安全 |

---

## 系统架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面 (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   组件层     │  │   状态层     │  │   样式层     │       │
│  │  Components  │  │   Zustand    │  │  TailwindCSS │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tauri IPC 通信层                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Rust 后端服务                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  密钥库管理  │  │   加密模块   │  │   数据库层   │       │
│  │    Vault     │  │    Crypto    │  │   Storage    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  条目 API    │  │  分类 API    │  │  设置 API    │       │
│  │  Entry API   │  │  Category    │  │  Settings    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLCipher 数据库                          │
│  ~/.mypwd/vault.db (加密存储)                                │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户输入主密码
       │
       ▼
┌──────────────────┐
│  Argon2id 哈希   │ ← 验证密码
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  派生主密钥      │ (Master Key - 32 bytes)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  解密数据库密钥  │ (Database Key - 32 bytes)
└──────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│  ChaCha20-Poly1305 加密/解密数据   │
│  - 每次加密使用随机 Nonce (12B)    │
│  - 格式: [nonce][ciphertext]       │
└────────────────────────────────────┘
```

---

## 快速开始

### 环境要求

| 要求 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 18.x | 20.x LTS |
| Rust | 1.70 | 最新稳定版 |
| npm | 9.x | 最新版 |
| 操作系统 | Windows 10+, macOS 10.15+, Ubuntu 20.04+ | - |

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/my-pwd.git
cd my-pwd

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run tauri dev
```

### 生产构建

```bash
# 构建生产版本
npm run tauri build

# 构建产物位置
# Windows: src-tauri/target/release/bundle/nsis/
# macOS:   src-tauri/target/release/bundle/dmg/
# Linux:   src-tauri/target/release/bundle/appimage/
```

---

## 使用说明

### 首次设置

1. **启动应用**：首次启动会进入密钥库创建流程
2. **设置主密码**：创建一个强密码作为主密码
3. **设置安全问题**：配置 3 个安全问题用于密码恢复
4. **完成设置**：设置完成后即可开始使用

### 添加密码条目

| 步骤 | 操作 |
|------|------|
| 1 | 点击左侧边栏的 "添加条目" 按钮 |
| 2 | 填写密码信息：标题、用户名、密码、URL |
| 3 | 选择分类（可选） |
| 4 | 添加备注（可选） |
| 5 | 点击 "创建条目" 保存 |

### 管理分类

进入 **设置** → **外观** 可以：
- 创建新分类（自定义图标和颜色）
- 编辑现有分类
- 删除未使用的分类

### 导入导出

进入 **设置** → **数据** 可以：
- **导出**：选择 JSON 或 CSV 格式导出所有数据
- **导入**：粘贴 JSON 或 CSV 数据导入密码

### 搜索密码

使用顶部搜索栏可以实时搜索：
- 按标题搜索
- 按用户名搜索
- 按网站 URL 搜索

---

## 安全机制

### 加密详解

#### 主密码派生（Argon2id）

```
主密码 + Salt → Argon2id → 主密钥 (32 bytes)
```

**配置参数：**
- 算法：Argon2id
- 内存成本：64 MB
- 迭代次数：3
- 并行度：4
- 输出长度：32 字节

#### 数据加密（ChaCha20-Poly1305）

```
明文 + 数据库密钥 + 随机 Nonce → ChaCha20-Poly1305 → 密文
```

**加密格式：**
```
[nonce (12 bytes)][ciphertext (variable)]
```

#### 双层密钥架构

| 密钥类型 | 来源 | 用途 | 存储 |
|---------|------|------|------|
| **主密钥** | 从主密码派生 | 解密数据库密钥 | 仅驻留内存 |
| **数据库密钥** | 随机生成 | 加密密码数据 | 加密后存储 |

### 安全措施

| 措施 | 实现方式 |
|------|---------|
| **密码哈希** | Argon2id（内存硬化 KDF） |
| **数据加密** | ChaCha20-Poly1305 AEAD |
| **内存保护** | Zeroize 自动清理敏感数据 |
| **SQL 注入防护** | 所有查询使用参数化 |
| **审计日志** | 记录关键操作（创建、删除、解锁） |

### 安全建议

1. ✅ 使用强密码（至少 12 位，包含大小写字母、数字、符号）
2. ✅ 不要重复使用主密码
3. ✅ 定期备份数据（导出功能）
4. ✅ 保持应用更新
5. ⚠️ 忘记主密码且无法回答安全问题将无法恢复数据

---

## 开发指南

### 项目结构

```
my-pwd/
├── src/                          # React 前端
│   ├── components/               # UI 组件
│   │   ├── MainLayout.tsx        # 主布局
│   │   ├── VaultSetup.tsx        # 密钥库设置
│   │   ├── EntryModal.tsx        # 密码条目弹窗
│   │   ├── AllPasswords.tsx      # 密码列表
│   │   ├── Favorites.tsx         # 收藏夹
│   │   ├── Trash.tsx             # 回收站
│   │   └── Settings.tsx          # 设置页面
│   ├── store/                    # Zustand 状态
│   │   └── useStore.ts           # 全局状态管理
│   ├── App.tsx                   # 应用根组件
│   └── main.tsx                  # 入口文件
│
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # Tauri 入口
│   │   ├── types.rs              # 类型定义
│   │   ├── crypto.rs             # 加密模块
│   │   ├── storage.rs            # 数据库操作
│   │   ├── vault.rs              # 密钥库管理
│   │   ├── entry_api.rs          # 密码条目 API
│   │   ├── category_api.rs       # 分类 API
│   │   └── settings_api.rs       # 导入导出 API
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
│
├── package.json                  # Node 依赖
├── vite.config.ts                # Vite 配置
├── tailwind.config.js            # Tailwind 配置
└── tsconfig.json                 # TypeScript 配置
```

### 添加新功能

#### 1. 添加前端组件

```typescript
// src/components/MyComponent.tsx
import React from 'react';

export function MyComponent() {
  return <div>My New Component</div>;
}
```

#### 2. 添加 Rust API

```rust
// src-tauri/src/my_api.rs
use crate::types::VaultState;

pub fn my_function(state: &VaultState) -> Result<String, String> {
    // 实现逻辑
    Ok("Success".to_string())
}
```

#### 3. 注册 Tauri 命令

```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn my_command(state: State<'_, AppState>) -> Result<String, String> {
    let app_state = state.0.lock().unwrap();
    // 调用 API 函数
}

.invoke_handler(tauri::generate_handler![
    // ... 其他命令
    my_command,
])
```

#### 4. 前端调用

```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke<string>('my_command');
```

### 代码规范

#### Rust 代码

```bash
# 格式化
cargo fmt

# Lint 检查
cargo clippy

# 运行测试
cargo test
```

#### TypeScript 代码

```bash
# 类型检查
npm run build

# Lint 检查
npm run lint
```

### 提交规范

遵循 Conventional Commits：

```
feat: 添加密码生成器功能
fix: 修复分类删除时的 Bug
docs: 更新 README 文档
style: 代码格式调整
refactor: 重构加密模块
test: 添加加密单元测试
chore: 更新依赖版本
```

---

## 数据库架构

### 核心表结构

#### master_password（主密码表）

```sql
CREATE TABLE master_password (
    id INTEGER PRIMARY KEY,
    password_hash TEXT NOT NULL,    -- Argon2id 哈希
    salt TEXT NOT NULL,             -- 密码盐值
    created_at INTEGER NOT NULL     -- 创建时间戳
);
```

#### security_questions（安全问题表）

```sql
CREATE TABLE security_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,         -- 问题文本
    answer_hash TEXT NOT NULL,      -- 答案哈希
    created_at INTEGER NOT NULL
);
```

#### categories（分类表）

```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,            -- UUID
    name TEXT NOT NULL,             -- 分类名称
    icon TEXT NOT NULL,             -- 图标 emoji
    color TEXT NOT NULL,            -- 颜色代码
    created_at INTEGER NOT NULL
);
```

#### entries（密码条目表）

```sql
CREATE TABLE entries (
    id TEXT PRIMARY KEY,            -- UUID
    title BLOB NOT NULL,            -- 加密
    username BLOB NOT NULL,         -- 加密
    password BLOB NOT NULL,         -- 加密
    url BLOB NOT NULL,              -- 加密
    notes BLOB NOT NULL,            -- 加密
    category_id TEXT,               -- 分类 ID（外键）
    favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,  -- 软删除标志
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
```

#### audit_logs（审计日志表）

```sql
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,           -- 操作类型
    details TEXT,                   -- 操作详情
    created_at INTEGER NOT NULL
);
```

### 数据库索引

```sql
CREATE INDEX idx_entries_category ON entries(category_id);
CREATE INDEX idx_entries_deleted ON entries(deleted);
CREATE INDEX idx_entries_favorite ON entries(favorite);
```

---

## API 参考

### 密钥库管理

| 命令 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `check_vault_setup` | - | `boolean` | 检查密钥库是否存在 |
| `create_vault` | `password`, `security_questions` | `void` | 创建新密钥库 |
| `unlock_vault` | `password` | `string` (vault_id) | 解锁密钥库 |
| `lock_vault` | - | `void` | 锁定密钥库 |

### 密码条目

| 命令 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `list_entries` | - | `Entry[]` | 获取所有条目 |
| `create_entry` | `EntryCreate` | `string` (id) | 创建新条目 |
| `update_entry` | `id`, `EntryUpdate` | `void` | 更新条目 |
| `delete_entry` | `id` | `void` | 删除条目（软删除） |
| `restore_entry` | `id` | `void` | 恢复已删除条目 |

### 分类管理

| 命令 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `list_categories` | - | `Category[]` | 获取所有分类 |
| `create_category` | `CategoryCreate` | `string` (id) | 创建新分类 |
| `update_category` | `id`, `CategoryUpdate` | `void` | 更新分类 |
| `delete_category` | `id` | `void` | 删除分类 |

### 数据导入导出

| 命令 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `export_data` | `format` (json/csv) | `string` | 导出数据 |
| `import_data` | `data`, `format` | `void` | 导入数据 |

### 类型定义

```typescript
// 密码条目
interface Entry {
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

// 分类
interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at: number;
}

// 安全问题
interface SecurityQuestion {
  question: string;
  answer: string;
}
```

---

## 常见问题

### Q: 忘记主密码怎么办？

A: 可以通过安全问题重置主密码。如果无法正确回答安全问题，数据将无法恢复。

### Q: 数据存储在哪里？

A: 数据存储在本地加密数据库中：
- Windows: `C:\Users\用户名\.mypwd\vault.db`
- macOS: `~/.mypwd/vault.db`
- Linux: `~/.mypwd/vault.db`

### Q: 可以同步到多个设备吗？

A: 目前不支持云端同步。可以通过导出/导入功能手动迁移数据。

### Q: 数据库文件可以复制吗？

A: 可以，但必须在锁定状态下复制，且不要在多个设备同时使用。

### Q: 如何完全卸载？

A:
1. 删除应用程序
2. 删除数据目录 `~/.mypwd/`

---

## 路线图

### v0.2.0（计划中）

- [ ] 密码生成器
- [ ] 密码强度检测
- [ ] 二步验证 (TOTP) 支持
- [ ] 浏览器扩展集成

### v0.3.0（计划中）

- [ ] 云端同步选项（自托管）
- [ ] 文件附件支持
- [ ] 共享密码功能
- [ ] 生物识别解锁

### 未来考虑

- [ ] 移动端应用
- [ ] CLI 工具
- [ ] Web 界面
- [ ] 插件系统

---

## 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: 添加某个功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范

- 遵循现有代码风格
- 添加必要的注释
- 更新相关文档
- 确保测试通过

---

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 致谢

感谢以下开源项目：

- [Tauri](https://tauri.app/) - 跨平台桌面框架
- [React](https://react.dev/) - UI 库
- [TailwindCSS](https://tailwindcss.com/) - CSS 框架
- [Zustand](https://zustand-demo.pmnd.rs/) - 状态管理
- [Argon2](https://github.com/P-H-C/phc-winner-argon2) - 密码哈希
- [ChaCha20-Poly1305](https://docs.rs/chacha20poly1305/) - 加密算法
- [rusqlite](https://docs.rs/rusqlite/) - SQLite 绑定
- [Lucide](https://lucide.dev/) - 图标库

---

<div align="center">

**[⬆ 返回顶部](#my-password-manager)**

Made with ❤️ by the community

</div>
