use rusqlite::{Connection, params, Result as SqliteResult};
use std::path::PathBuf;
use crate::types::*;
use crate::crypto;

const DB_FILE: &str = "vault.db";

// ---------------------------------------------------------------------------
// Login rate limiting constants
// ---------------------------------------------------------------------------
/// 连续失败多少次后开始锁定
const MAX_CONSECUTIVE_FAILURES: u32 = 5;
/// 锁定后每次递增的等待秒数（首次锁定 30s，之后翻倍：60s、120s…）
const BASE_LOCKOUT_SECS: u64 = 30;
/// 最大等待秒数（防止整数溢出）
const MAX_LOCKOUT_SECS: u64 = 3600;

/// 解析锁定状态错误信息的辅助结构
#[derive(Debug)]
pub struct LockoutInfo {
    pub wait_seconds: u64,
}

impl std::fmt::Display for LockoutInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.wait_seconds >= 3600 {
            write!(f, "账户已锁定，请在 {} 小时后重试", self.wait_seconds / 3600)
        } else if self.wait_seconds >= 60 {
            write!(f, "账户已锁定，请在 {} 分钟后重试", self.wait_seconds / 60)
        } else {
            write!(f, "账户已锁定，请在 {} 秒后重试", self.wait_seconds)
        }
    }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

pub fn get_db_path() -> PathBuf {
    let mut path = dirs::home_dir().expect("Could not find home directory");
    path.push(".mypwd");
    std::fs::create_dir_all(&path).expect("Could not create config directory");
    path.push(DB_FILE);
    path
}

pub fn check_vault_exists() -> bool {
    get_db_path().exists()
}

pub fn get_connection() -> Result<Connection, String> {
    let db_path = get_db_path();

    if !db_path.exists() {
        return Err("Vault does not exist".to_string());
    }

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // P0-2 fix: 对已有 vault，确保新增的 login_attempts 表存在
    // （create_vault 路径已在 init_database 里建表，unlock_vault 走这里需要补建）
    conn.execute(
        "CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            consecutive_failures INTEGER NOT NULL DEFAULT 0,
            first_failure_at INTEGER,
            locked_until INTEGER
        )",
        [],
    )
    .map_err(|e| format!("Failed to create login_attempts table: {}", e))?;

    conn.execute(
        "INSERT OR IGNORE INTO login_attempts (id, consecutive_failures) VALUES (1, 0)",
        [],
    )
    .map_err(|e| format!("Failed to init login_attempts row: {}", e))?;

    Ok(conn)
}

pub fn create_connection() -> Result<Connection, String> {
    let db_path = get_db_path();

    Connection::open(&db_path)
        .map_err(|e| format!("Failed to create database: {}", e))
}

// ---------------------------------------------------------------------------
// Database initialisation
// ---------------------------------------------------------------------------

/// 当前数据库 schema 版本
const CURRENT_SCHEMA_VERSION: u32 = 2;

pub fn init_database(conn: &Connection) -> Result<(), String> {
    // 启用 WAL 模式以提升并发写入性能和崩溃恢复能力
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

    // 创建 schema 版本追踪表
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        );"
    )
    .map_err(|e| format!("Failed to create schema_version table: {}", e))?;

    // 创建所有基础表（IF NOT EXISTS 保证幂等）
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS master_password (
            id INTEGER PRIMARY KEY,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS security_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            title BLOB NOT NULL,
            username BLOB NOT NULL,
            password BLOB NOT NULL,
            url BLOB NOT NULL,
            notes BLOB NOT NULL,
            category_id TEXT,
            favorite INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS entry_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id TEXT NOT NULL,
            data BLOB NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            details TEXT,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS password_verification (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            success INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS vault_keys (
            id INTEGER PRIMARY KEY,
            encrypted_key BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS vault_config (
            id INTEGER PRIMARY KEY,
            vault_id TEXT NOT NULL
        );

        -- 登录尝试次数追踪表（P0-2 防暴力破解）
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            consecutive_failures INTEGER NOT NULL DEFAULT 0,
            first_failure_at INTEGER,
            locked_until INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category_id);
        CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted);
        CREATE INDEX IF NOT EXISTS idx_entries_favorite ON entries(favorite);
        "
    )
    .map_err(|e| format!("Failed to initialize database: {}", e))?;

    // 确保基础行存在
    conn.execute(
        "INSERT OR IGNORE INTO login_attempts (id, consecutive_failures) VALUES (1, 0)",
        [],
    )
    .map_err(|e| format!("Failed to init login_attempts: {}", e))?;

    // 执行版本化迁移
    let current = get_schema_version(conn);
    if current < CURRENT_SCHEMA_VERSION {
        apply_migrations(conn, current)?;
    }

    Ok(())
}

/// 获取当前 schema 版本号，0 表示未初始化
fn get_schema_version(conn: &Connection) -> u32 {
    conn.query_row(
        "SELECT MAX(version) FROM schema_version",
        [],
        |row| row.get::<_, Option<u32>>(0),
    )
    .ok()
    .flatten()
    .unwrap_or(0)
}

/// 记录已应用的版本
fn record_version(conn: &Connection, version: u32) -> Result<(), String> {
    conn.execute(
        "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
        rusqlite::params![version, chrono::Utc::now().timestamp()],
    )
    .map_err(|e| format!("Failed to record schema version: {}", e))?;
    Ok(())
}

/// 从指定版本开始依次应用迁移
fn apply_migrations(conn: &Connection, from_version: u32) -> Result<(), String> {
    // v1: 初始 schema 已通过上面的 CREATE TABLE IF NOT EXISTS 完成
    //     此处记录初始版本（仅对旧数据库补记）
    if from_version < 1 {
        let _ = conn.execute(
            "ALTER TABLE vault_config ADD COLUMN recovery_salt TEXT",
            [],
        );
        record_version(conn, 1)?;
    }

    // v2: 启用 WAL 模式 + schema_version 表（已在上面的 PRAGMA 和建表中处理）
    if from_version < 2 {
        // 确保 login_attempts 行存在（向前兼容）
        conn.execute(
            "INSERT OR IGNORE INTO login_attempts (id, consecutive_failures) VALUES (1, 0)",
            [],
        )
        .map_err(|e| format!("Migration v2 failed: {}", e))?;
        record_version(conn, 2)?;
    }

    // 未来迁移在此处添加：
    // if from_version < 3 {
    //     // v3: 添加 xxx 列
    //     record_version(conn, 3)?;
    // }

    Ok(())
}

// ---------------------------------------------------------------------------
// Password verification with rate limiting (P0-2)
// ---------------------------------------------------------------------------

/// 检查当前是否处于锁定状态，返回需要等待的秒数（0 = 未锁定）
fn get_lockout_remaining(conn: &Connection) -> Result<u64, String> {
    let row: Option<(u32, Option<i64>)> = conn
        .query_row(
            "SELECT consecutive_failures, locked_until FROM login_attempts WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    let (_, locked_until) = match row {
        Some(r) => r,
        None => return Ok(0),
    };

    let now = chrono::Utc::now().timestamp();
    if let Some(until) = locked_until {
        let remaining = until - now;
        if remaining > 0 {
            return Ok(remaining as u64);
        }
    }
    Ok(0)
}

/// 根据连续失败次数计算锁定时长（指数退避）
fn lockout_duration(failures: u32) -> u64 {
    let factor = failures.saturating_sub(MAX_CONSECUTIVE_FAILURES);
    let secs = BASE_LOCKOUT_SECS * 2u64.pow(factor);
    secs.min(MAX_LOCKOUT_SECS)
}

/// 验证主密码（含防暴力锁定逻辑）
/// - 查询当前锁定状态，已锁定则返回需要等待的秒数
/// - 验证成功：重置连续失败计数
/// - 验证失败：增加连续失败计数，达到阈值后写入锁定时间
pub fn verify_master_password(conn: &Connection, password: &str) -> Result<bool, String> {
    // 第一步：检查是否被锁定
    if let Some(wait) = check_and_report_lockout(conn)? {
        return Err(LockoutInfo { wait_seconds: wait }.to_string());
    }

    // 第二步：执行实际验证
    let mut stmt = conn
        .prepare("SELECT password_hash FROM master_password WHERE id = 1")
        .map_err(|e| format!("Failed to query master password: {}", e))?;

    let result = stmt
        .query_row([], |row| row.get::<_, String>(0))
        .ok();

    match result {
        Some(hash) => {
            match crypto::verify_password_hash(&hash, password.as_bytes()) {
                Ok(true) => {
                    // 验证成功：重置失败计数
                    reset_login_attempts(conn)?;
                    eprintln!("[DEBUG] Password verified successfully");
                    Ok(true)
                }
                Ok(false) => {
                    // 验证失败：记录失败次数，可能触发锁定
                    record_failed_attempt(conn)?;
                    eprintln!("[DEBUG] Password verification result: incorrect");
                    Ok(false)
                }
                Err(e) => {
                    eprintln!("[DEBUG] Password verification error: {}", e);
                    Err(format!("Password verification failed: {}", e))
                }
            }
        }
        None => Err("Master password not found".to_string()),
    }
}

/// 检查锁定状态，返回 Option<wait_seconds>（Some = 仍被锁定，None = 未锁定）
fn check_and_report_lockout(conn: &Connection) -> Result<Option<u64>, String> {
    let wait = get_lockout_remaining(conn)?;
    if wait > 0 {
        return Ok(Some(wait));
    }
    Ok(None)
}

/// 记录一次登录失败，增加计数器，达到阈值则写入锁定时间
fn record_failed_attempt(conn: &Connection) -> Result<(), String> {
    let (failures, _first_failure_at) = conn
        .query_row(
            "SELECT consecutive_failures, first_failure_at FROM login_attempts WHERE id = 1",
            [],
            |row| Ok((row.get::<_, u32>(0)?, row.get::<_, Option<i64>>(1)?)),
        )
        .map_err(|e| format!("Failed to query login_attempts: {}", e))?;

    let now = chrono::Utc::now().timestamp();

    if failures == 0 {
        // 第一次失败：记录开始时间
        conn.execute(
            "UPDATE login_attempts SET consecutive_failures = 1, first_failure_at = ? WHERE id = 1",
            params![now],
        )
        .map_err(|e| format!("Failed to record first failure: {}", e))?;
    } else {
        let new_failures = failures + 1;
        conn.execute(
            "UPDATE login_attempts SET consecutive_failures = ? WHERE id = 1",
            params![new_failures],
        )
        .map_err(|e| format!("Failed to increment failure count: {}", e))?;

        // 达到锁定阈值：计算锁定时长并写入
        if new_failures >= MAX_CONSECUTIVE_FAILURES {
            let duration = lockout_duration(new_failures);
            let locked_until = now + duration as i64;
            conn.execute(
                "UPDATE login_attempts SET locked_until = ? WHERE id = 1",
                params![locked_until],
            )
            .map_err(|e| format!("Failed to set lockout time: {}", e))?;
            eprintln!(
                "[SECURITY] Account locked for {}s after {} consecutive failures",
                duration, new_failures
            );
        }
    }

    Ok(())
}

/// 验证成功后调用，重置所有失败计数器
fn reset_login_attempts(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "UPDATE login_attempts SET consecutive_failures = 0, first_failure_at = NULL, locked_until = NULL WHERE id = 1",
        [],
    )
    .map_err(|e| format!("Failed to reset login attempts: {}", e))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Remaining storage functions (unchanged)
// ---------------------------------------------------------------------------

pub fn save_master_password(conn: &Connection, password_hash: &str, salt: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO master_password (id, password_hash, salt, created_at) VALUES (1, ?, ?, ?)",
        params![password_hash, salt, chrono::Utc::now().timestamp()],
    )
    .map_err(|e| format!("Failed to save master password: {}", e))?;

    Ok(())
}

pub fn save_security_questions(
    conn: &Connection,
    questions: &[SecurityQuestion],
) -> Result<(), String> {
    let salt = SaltString::generate(&mut OsRng);

    for question in questions {
        let answer_hash = crypto::hash_password(question.answer.as_bytes(), &salt)?;
        conn.execute(
            "INSERT INTO security_questions (question, answer_hash, created_at) VALUES (?, ?, ?)",
            params![
                question.question,
                answer_hash,
                chrono::Utc::now().timestamp()
            ],
        )
        .map_err(|e| format!("Failed to save security question: {}", e))?;
    }

    Ok(())
}

pub fn get_security_questions(conn: &Connection) -> Result<Vec<SecurityQuestion>, String> {
    let mut stmt = conn
        .prepare("SELECT question FROM security_questions")
        .map_err(|e| format!("Failed to query security questions: {}", e))?;

    let questions = stmt
        .query_map([], |row| Ok(SecurityQuestion {
            question: row.get(0)?,
            answer: String::new(),
        }))
        .map_err(|e| format!("Failed to map security questions: {}", e))?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| format!("Failed to collect security questions: {}", e))?;

    Ok(questions)
}

pub fn verify_security_answers(conn: &Connection, answers: &[String]) -> Result<bool, String> {
    let mut stmt = conn
        .prepare("SELECT answer_hash FROM security_questions ORDER BY id")
        .map_err(|e| format!("Failed to query security answers: {}", e))?;

    let hashes = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to map security answers: {}", e))?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| format!("Failed to collect security answers: {}", e))?;

    if hashes.len() != answers.len() {
        return Err("Incorrect number of answers".to_string());
    }

    for (hash, answer) in hashes.iter().zip(answers.iter()) {
        if !crypto::verify_password_hash(hash, answer.as_bytes())? {
            return Ok(false);
        }
    }

    Ok(true)
}

pub fn update_master_password(conn: &Connection, new_hash: &str, new_salt: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE master_password SET password_hash = ?, salt = ? WHERE id = 1",
        params![new_hash, new_salt],
    )
    .map_err(|e| format!("Failed to update master password: {}", e))?;

    Ok(())
}

pub fn clear_all_data() -> Result<(), String> {
    let db_path = get_db_path();
    let wal_path = db_path.with_extension("db-wal");
    let shm_path = db_path.with_extension("db-shm");

    // 尝试多次删除，解决 Windows 下的文件占位延迟
    let mut success = false;
    let mut last_err = String::new();

    for _ in 0..5 {
        let mut any_failed = false;

        if db_path.exists() {
            if let Err(e) = std::fs::remove_file(&db_path) {
                last_err = format!("Failed to delete database: {}", e);
                any_failed = true;
            }
        }

        if !any_failed && wal_path.exists() {
            if let Err(e) = std::fs::remove_file(&wal_path) {
                last_err = format!("Failed to delete WAL: {}", e);
                any_failed = true;
            }
        }

        if !any_failed && shm_path.exists() {
            if let Err(e) = std::fs::remove_file(&shm_path) {
                last_err = format!("Failed to delete SHM: {}", e);
                any_failed = true;
            }
        }

        if !any_failed {
            success = true;
            break;
        }

        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    if !success {
        return Err(last_err);
    }

    Ok(())
}

pub fn log_audit(conn: &Connection, action: &str, details: Option<String>) -> Result<(), String> {
    conn.execute(
        "INSERT INTO audit_logs (action, details, created_at) VALUES (?, ?, ?)",
        params![action, details, chrono::Utc::now().timestamp()],
    )
    .map_err(|e| format!("Failed to log audit: {}", e))?;

    Ok(())
}

pub fn log_password_verification(conn: &Connection, success: bool) -> Result<(), String> {
    conn.execute(
        "INSERT INTO password_verification (success, created_at) VALUES (?, ?)",
        params![success, chrono::Utc::now().timestamp()],
    )
    .map_err(|e| format!("Failed to log password verification: {}", e))?;

    Ok(())
}

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::SaltString;
