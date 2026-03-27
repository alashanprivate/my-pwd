# Rust 后端模块 - AI 上下文文档

> 最后更新：2026-03-24 17:48:41

---

## 变更记录 (Changelog)

### 2026-03-24 17:48:41
- 初始化后端模块文档
- 完成核心模块分析与 API 梳理

---

[根目录](../CLAUDE.md) > **src-tauri**

---

## 模块职责

Rust 后端模块负责：
- 密钥库生命周期管理（创建/解锁/锁定）
- 加密与解密操作（Argon2id + ChaCha20-Poly1305）
- 数据库持久化（SQLite + rusqlite）
- 密码条目 CRUD API
- 分类管理 API
- 导入导出功能（JSON/CSV）
- 审计日志记录

---

## 入口与启动

### Tauri 入口

**文件：** [`src/main.rs`](../src-tauri/src/main.rs)

**全局状态：**
```rust
struct AppState(Mutex<Option<VaultState>>);
```

**命令注册：**
```rust
.invoke_handler(tauri::generate_handler![
    check_vault_setup,
    create_vault,
    unlock_vault,
    lock_vault,
    get_security_questions,
    verify_security_answers,
    reset_password,
    list_entries,
    create_entry,
    update_entry,
    delete_entry,
    restore_entry,
    list_categories,
    create_category,
    update_category,
    delete_category,
    export_data,
    import_data,
    clear_all_data,
])
```

### 构建脚本

**文件：** [`build.rs`](../src-tauri/build.rs)
```rust
fn main() {
    tauri_build::build()
}
```

---

## 核心模块详解

### 模块架构

```
src-tauri/src/
├── main.rs              # Tauri 入口，命令注册
├── types.rs             # 类型定义
├── crypto.rs            # 加密/解密
├── storage.rs           # 数据库操作
├── vault.rs             # 密钥库管理
├── entry_api.rs         # 密码条目 API
├── category_api.rs      # 分类 API
└── settings_api.rs      # 导入导出 API
```

### 1. 类型定义（types.rs）

**文件：** [`src/types.rs`](../src-tauri/src/types.rs)

**核心类型：**
```rust
// 密码条目
pub struct Entry {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
    pub category_id: String,
    pub favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted: bool,
}

// 分类
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub created_at: i64,
}

// 密钥库状态
pub struct VaultState {
    pub vault_id: String,
    pub master_key: Vec<u8>,      // 32 字节
    pub database_key: Vec<u8>,    // 32 字节
}
```

### 2. 加密模块（crypto.rs）

**文件：** [`src/crypto.rs`](../src-tauri/src/crypto.rs)

**常量：**
```rust
const MASTER_KEY_SIZE: usize = 32;  // AES-256
const NONCE_SIZE: usize = 12;       // ChaCha20-Poly1305 nonce
```

**核心功能：**

**主密钥派生（Argon2id）：**
```rust
pub struct MasterKey([u8; MASTER_KEY_SIZE]);

impl MasterKey {
    // 从密码派生主密钥
    pub fn derive_from_password(password: &[u8], salt: &SaltString) -> Result<Self, String>;

    // 生成随机密钥
    pub fn generate_random() -> Self;

    // 获取字节引用
    pub fn as_bytes(&self) -> &[u8];
}
```

**数据加密/解密（ChaCha20-Poly1305）：**
```rust
// 加密：返回 [nonce (12 bytes)][ciphertext]
pub fn encrypt_data(key: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String>;

// 解密：输入 [nonce][ciphertext]，返回 plaintext
pub fn decrypt_data(key: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, String>;
```

**密码哈希与验证：**
```rust
// Argon2id 哈希
pub fn hash_password(password: &[u8], salt: &SaltString) -> Result<String, String>;

// 验证密码哈希
pub fn verify_password_hash(password_hash: &str, password: &[u8]) -> Result<bool, String>;
```

**安全特性：**
- `MasterKey` 实现 `ZeroizeOnDrop` trait，离开作用域时自动清零
- 每次加密使用随机 nonce
- 使用 AEAD（Authenticated Encryption with Associated Data）

### 3. 数据库模块（storage.rs）

**文件：** [`src/storage.rs`](../src-tauri/src/storage.rs)

**数据库路径：**
```rust
pub fn get_db_path() -> PathBuf {
    // ~/.mypwd/vault.db
}
```

**数据库初始化：**
```rust
pub fn init_database(conn: &Connection) -> Result<(), String> {
    // 创建表：
    // - master_password
    // - security_questions
    // - categories
    // - entries
    // - entry_history
    // - audit_logs
    // - password_verification
    // - vault_keys (加密的数据库密钥)
    // - vault_config (vault_id)
}
```

**关键表结构：**

**entries 表（所有敏感字段加密存储）：**
```sql
CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    title BLOB NOT NULL,        -- 加密
    username BLOB NOT NULL,     -- 加密
    password BLOB NOT NULL,     -- 加密
    url BLOB NOT NULL,          -- 加密
    notes BLOB NOT NULL,        -- 加密
    category_id TEXT,
    favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
```

**审计日志：**
```rust
pub fn log_audit(conn: &Connection, action: &str, details: Option<String>) -> Result<(), String>;
pub fn log_password_verification(conn: &Connection, success: bool) -> Result<(), String>;
```

### 4. 密钥库管理（vault.rs）

**文件：** [`src/vault.rs`](../src-tauri/src/vault.rs)

**全局状态：**
```rust
static VAULT_STATE: Mutex<Option<VaultState>> = Mutex::new(None);
```

**核心功能：**

**创建密钥库：**
```rust
pub fn create_vault(password: &str, security_questions: &[SecurityQuestion]) -> Result<(), String> {
    // 1. 生成 salt
    // 2. 哈希密码（Argon2id）
    // 3. 创建数据库
    // 4. 保存主密码哈希
    // 5. 保存安全问题
    // 6. 创建默认分类（Social, Email, Finance, Work, Entertainment）
    // 7. 派生主密钥
    // 8. 生成随机数据库密钥
    // 9. 加密数据库密钥并存储
    // 10. 生成 vault_id
}
```

**解锁密钥库：**
```rust
pub fn unlock_vault(password: &str) -> Result<VaultState, String> {
    // 1. 验证主密码
    // 2. 记录验证日志
    // 3. 获取 salt
    // 4. 派生主密钥
    // 5. 解密数据库密钥
    // 6. 获取 vault_id
    // 7. 存储到全局状态
}
```

**锁定密钥库：**
```rust
pub fn lock_vault() -> Result<(), String> {
    // 清除全局状态
}
```

**默认分类：**
- Social（👥，紫色 #8b5cf6）
- Email（📧，粉色 #ec4899）
- Finance（💰，绿色 #22c55e）
- Work（💼，蓝色 #3b82f6）
- Entertainment（🎮，橙色 #f97316）

### 5. 密码条目 API（entry_api.rs）

**文件：** [`src/entry_api.rs`](../src-tauri/src/entry_api.rs)

**CRUD 操作：**

**列出所有条目：**
```rust
pub fn list_entries(state: &VaultState) -> Result<Vec<Entry>, String> {
    // 1. 查询数据库
    // 2. 解密所有字段（title, username, password, url, notes）
    // 3. 返回 Entry 列表
}
```

**创建条目：**
```rust
pub fn create_entry(state: &mut VaultState, entry: EntryCreate) -> Result<String, String> {
    // 1. 生成唯一 ID
    // 2. 加密所有敏感字段
    // 3. 插入数据库
    // 4. 记录审计日志
    // 5. 返回新 ID
}
```

**更新条目：**
```rust
pub fn update_entry(state: &mut VaultState, id: &str, entry: EntryUpdate) -> Result<(), String> {
    // 1. 获取现有条目
    // 2. 加密更新的字段
    // 3. 更新数据库
    // 4. 记录审计日志
}
```

**删除条目（软删除）：**
```rust
pub fn delete_entry(state: &VaultState, id: &str) -> Result<(), String> {
    // 设置 deleted = 1
}
```

**恢复条目：**
```rust
pub fn restore_entry(state: &VaultState, id: &str) -> Result<(), String> {
    // 设置 deleted = 0
}
```

### 6. 分类 API（category_api.rs）

**文件：** [`src/category_api.rs`](../src-tauri/src/category_api.rs)

**CRUD 操作：**
```rust
pub fn list_categories(state: &VaultState) -> Result<Vec<Category>, String>;
pub fn create_category(state: &mut VaultState, category: CategoryCreate) -> Result<String, String>;
pub fn update_category(state: &mut VaultState, id: &str, category: CategoryUpdate) -> Result<(), String>;
pub fn delete_category(state: &VaultState, id: &str) -> Result<(), String> {
    // 1. 先解除关联条目的 category_id
    // 2. 再删除分类
}
```

### 7. 导入导出 API（settings_api.rs）

**文件：** [`src/settings_api.rs`](../src-tauri/src/settings_api.rs)

**导出数据：**
```rust
pub fn export_data(state: &VaultState, format: &str) -> Result<String, String> {
    match format {
        "json" => {
            // 返回 JSON 字符串
            // {
            //   "entries": [...],
            //   "categories": [...],
            //   "exported_at": "2026-03-24T17:48:41+00:00"
            // }
        }
        "csv" => {
            // 返回 CSV 字符串
            // title,username,password,url,notes,category,favorite,created_at,updated_at
        }
        _ => Err("Unsupported format".to_string())
    }
}
```

**导入数据：**
```rust
pub fn import_data(state: &mut VaultState, data: &str, format: &str) -> Result<(), String> {
    match format {
        "json" => import_json(state, data),
        "csv" => import_csv(state, data),
        _ => Err("Unsupported format".to_string())
    }
}
```

**CSV 解析：**
- 支持逗号分隔
- 支持双引号包裹
- 支持双引号转义（`""`）

---

## 对外接口（Tauri Commands）

### 命令清单

| 命令 | 模块 | 说明 |
|-----|------|------|
| `check_vault_setup` | main | 检查密钥库是否存在 |
| `create_vault` | vault | 创建新密钥库 |
| `unlock_vault` | vault | 解锁密钥库 |
| `lock_vault` | vault | 锁定密钥库 |
| `get_security_questions` | vault | 获取安全问题 |
| `verify_security_answers` | vault | 验证安全答案 |
| `reset_password` | vault | 重置主密码（未实现） |
| `list_entries` | entry_api | 列出所有密码条目 |
| `create_entry` | entry_api | 创建密码条目 |
| `update_entry` | entry_api | 更新密码条目 |
| `delete_entry` | entry_api | 删除密码条目 |
| `restore_entry` | entry_api | 恢复已删除条目 |
| `list_categories` | category_api | 列出所有分类 |
| `create_category` | category_api | 创建分类 |
| `update_category` | category_api | 更新分类 |
| `delete_category` | category_api | 删除分类 |
| `export_data` | settings_api | 导出数据 |
| `import_data` | settings_api | 导入数据 |
| `clear_all_data` | storage | 清除所有数据 |

### 命令签名示例

```rust
#[tauri::command]
async fn create_vault(
    password: String,
    security_questions: Vec<SecurityQuestion>,
) -> Result<(), String> {
    vault::create_vault(&password, &security_questions)
}

#[tauri::command]
async fn unlock_vault(password: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault_state = vault::unlock_vault(&password)?;
    {
        let mut app_state = state.0.lock().unwrap();
        *app_state = Some(vault_state.clone());
    }
    Ok(vault_state.vault_id)
}
```

---

## 关键依赖与配置

### Cargo.toml

**文件：** [`Cargo.toml`](../src-tauri/Cargo.toml)

**核心依赖：**
```toml
[dependencies]
tauri = { version = "1.5", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rusqlite = { version = "0.30", features = ["bundled"] }
argon2 = "0.5"
chacha20poly1305 = "0.10"
zeroize = { version = "1.6", features = ["zeroize_derive"] }
rand = "0.8"
base64 = "0.21"
hex = "0.4"
thiserror = "1.0"
chrono = "0.4"
dirs = "5.0"
```

**特性：**
```toml
[features]
custom-protocol = ["tauri/custom-protocol"]  # 生产构建必须
```

### Tauri 配置

**文件：** [`tauri.conf.json`](../src-tauri/tauri.conf.json)

**关键配置：**
```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "tauri": {
    "allowlist": {
      "shell": {
        "open": true  // 允许打开外部链接
      }
    },
    "windows": [{
      "fullscreen": false,
      "resizable": true,
      "title": "My Password Manager",
      "width": 1200,
      "height": 800,
      "minWidth": 800,
      "minHeight": 600
    }]
  }
}
```

---

## 数据模型

### 核心数据流

```
用户输入密码
    ↓
Argon2id 哈希（验证）
    ↓
派生主密钥（Master Key）
    ↓
解密数据库密钥（Database Key）
    ↓
使用 Database Key 加密/解密条目字段
```

### 加密流程

**存储加密数据：**
```
plaintext → ChaCha20-Poly1305 → [nonce (12B)][ciphertext]
```

**读取加密数据：**
```
[nonce (12B)][ciphertext] → ChaCha20-Poly1305 → plaintext
```

---

## 测试与质量

### 单元测试

**文件：** [`src/crypto.rs`](../src-tauri/src/crypto.rs) (第 103-115 行)

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_encryption_decryption() {
        let key = MasterKey::generate_random();
        let plaintext = b"Hello, world!";
        let encrypted = encrypt_data(key.as_bytes(), plaintext).unwrap();
        let decrypted = decrypt_data(key.as_bytes(), &encrypted).unwrap();
        assert_eq!(plaintext, decrypted.as_slice());
    }
}
```

### 运行测试

```bash
cd src-tauri
cargo test
```

### 代码质量工具

- **格式化**：`cargo fmt`
- **Lint**：`cargo clippy`
- **文档**：`cargo doc`

---

## 安全最佳实践

### 已实现的安全措施

1. **密码哈希**：使用 Argon2id（内存硬化的 KDF）
2. **数据加密**：ChaCha20-Poly1305 AEAD
3. **密钥管理**：双层密钥架构（主密钥 + 数据库密钥）
4. **内存安全**：使用 `zeroize` 清除敏感数据
5. **SQL 注入防护**：所有查询使用参数化
6. **审计日志**：记录所有关键操作

### 安全注意事项

- ⚠️ **密钥库未锁定时密钥驻留内存**
- ⚠️ **密码重置功能未完整实现**
- ⚠️ **无防暴力破解机制（如速率限制）**
- ⚠️ **数据库密钥每次解锁时重新生成（应持久化）**

---

## 已知问题与限制

### 未完整实现的功能

1. **密码重置**
   - `vault.rs::reset_password` 返回 "not yet implemented"
   - 需要重新设计以支持安全问答验证

2. **安全问答验证**
   - `vault.rs::verify_security_answers` 当前总是返回 Ok
   - 需要连接数据库验证逻辑

3. **数据库密钥持久化**
   - `vault.rs::get_encrypted_db_key` 每次生成新密钥
   - 应从数据库读取持久化的加密密钥

### 性能优化建议

1. **批量操作**：导入大量条目时使用事务
2. **索引优化**：为常用查询字段添加索引
3. **连接池**：考虑使用连接池管理数据库连接
4. **懒加载**：大量条目时考虑分页加载

---

## 常见问题 (FAQ)

### Q: 如何添加新的数据库表？
1. 在 `storage.rs::init_database` 中添加 `CREATE TABLE` 语句
2. 在 `types.rs` 中定义对应的 Rust 结构体
3. 创建相应的 API 模块（如 `my_feature_api.rs`）
4. 在 `main.rs` 中注册 Tauri 命令

### Q: 如何修改加密算法？
1. 修改 `crypto.rs` 中的加密函数
2. 考虑向后兼容性（可能需要数据迁移）
3. 更新单元测试

### Q: 如何添加审计日志？
```rust
storage::log_audit(&conn, "action_name", Some("details".to_string()))?;
```

---

## 相关文件清单

### 核心模块
- `src/main.rs` - Tauri 入口
- `src/types.rs` - 类型定义
- `src/crypto.rs` - 加密模块
- `src/storage.rs` - 数据库操作
- `src/vault.rs` - 密钥库管理
- `src/entry_api.rs` - 密码条目 API
- `src/category_api.rs` - 分类 API
- `src/settings_api.rs` - 导入导出 API

### 配置文件
- `Cargo.toml` - Rust 依赖配置
- `Cargo.lock` - 依赖锁定文件
- `tauri.conf.json` - Tauri 配置
- `build.rs` - 构建脚本

### 构建产物
- `target/` - 编译输出目录（已在 .gitignore 中）
- `target/release/` - 生产构建
- `target/debug/` - 调试构建

---

## 依赖项摘要

### 核心依赖
- `tauri 1.5` - 桌面应用框架
- `rusqlite 0.30` - SQLite 绑定
- `argon2 0.5` - 密码哈希
- `chacha20poly1305 0.10` - AEAD 加密
- `zeroize 1.6` - 安全内存清理

### 序列化
- `serde 1.0` - 序列化框架
- `serde_json 1.0` - JSON 序列化

### 工具库
- `chrono 0.4` - 时间处理
- `rand 0.8` - 随机数生成
- `hex 0.4` - 十六进制编码
- `base64 0.21` - Base64 编码
- `dirs 5.0` - 目录路径
- `thiserror 1.0` - 错误处理
