use rusqlite::{Connection, params, Result as SqliteResult};
use std::path::PathBuf;
use crate::types::*;
use crate::crypto;

const DB_FILE: &str = "vault.db";

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

    Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))
}

pub fn create_connection() -> Result<Connection, String> {
    let db_path = get_db_path();

    Connection::open(&db_path)
        .map_err(|e| format!("Failed to create database: {}", e))
}

pub fn init_database(conn: &Connection) -> Result<(), String> {
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

        CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category_id);
        CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted);
        CREATE INDEX IF NOT EXISTS idx_entries_favorite ON entries(favorite);
        "
    ).map_err(|e| format!("Failed to initialize database: {}", e))?;

    // 为了向前兼容旧数据库，检查并添加 recovery_salt 列
    let _ = conn.execute("ALTER TABLE vault_config ADD COLUMN recovery_salt TEXT", []);

    Ok(())
}

pub fn save_master_password(conn: &Connection, password_hash: &str, salt: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO master_password (id, password_hash, salt, created_at) VALUES (1, ?, ?, ?)",
        params![password_hash, salt, chrono::Utc::now().timestamp()],
    )
    .map_err(|e| format!("Failed to save master password: {}", e))?;

    Ok(())
}

pub fn verify_master_password(conn: &Connection, password: &str) -> Result<bool, String> {
    let mut stmt = conn
        .prepare("SELECT password_hash FROM master_password WHERE id = 1")
        .map_err(|e| format!("Failed to query master password: {}", e))?;

    let result = stmt
        .query_row([], |row| row.get::<_, String>(0))
        .ok();

    match result {
        Some(hash) => {
            eprintln!("[DEBUG] Verifying password against hash: {}...", &hash[..50.min(hash.len())]);
            eprintln!("[DEBUG] Input password length: {}", password.len());
            match crypto::verify_password_hash(&hash, password.as_bytes()) {
                Ok(verified) => {
                    eprintln!("[DEBUG] Password verification result: {}", verified);
                    Ok(verified)
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
            answer: String::new(), // We don't return the actual answers
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

    // Also clear the in-memory vault state
    let _ = crate::vault::lock_vault();

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
