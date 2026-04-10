use argon2::password_hash::{SaltString, rand_core::OsRng};
use crate::types::*;
use crate::crypto;
use crate::storage;
use rusqlite::OptionalExtension;

/// 创建密钥库，返回 VaultState（由调用方存储到 AppState）
pub fn create_vault(password: &str, security_questions: &[SecurityQuestion]) -> Result<VaultState, String> {
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = crypto::hash_password(password.as_bytes(), &salt)?;

    let conn = storage::create_connection()?;
    storage::init_database(&conn)?;

    storage::save_master_password(&conn, &password_hash, &salt.to_string())?;
    storage::save_security_questions(&conn, security_questions)?;

    create_default_categories(&conn)?;

    let vault_id = get_vault_id(&conn)?;
    let master_key = crypto::MasterKey::derive_from_password(password.as_bytes(), &salt)?;
    let database_key = crypto::MasterKey::generate_random();

    let encrypted_db_key = crypto::encrypt_data(master_key.as_bytes(), database_key.as_bytes())?;
    save_encrypted_db_key(&conn, &encrypted_db_key)?;

    let recovery_material = security_questions.iter()
        .map(|q| q.answer.trim().to_lowercase())
        .collect::<Vec<_>>()
        .join("|");
    let recovery_salt = SaltString::generate(&mut OsRng);
    let recovery_key = crypto::MasterKey::derive_from_password(recovery_material.as_bytes(), &recovery_salt)?;
    let encrypted_recovery_key = crypto::encrypt_data(recovery_key.as_bytes(), database_key.as_bytes())?;
    save_recovery_data(&conn, &recovery_salt.to_string(), &encrypted_recovery_key)?;

    Ok(VaultState {
        vault_id: vault_id.clone(),
        master_key: master_key.to_vec(),
        database_key: database_key.to_vec(),
    })
}

/// 解锁密钥库，返回 VaultState（由调用方存储到 AppState）
pub fn unlock_vault(password: &str) -> Result<VaultState, String> {
    eprintln!("[DEBUG] unlock_vault called with password length: {}", password.len());

    let conn = storage::get_connection()?;

    // verify_master_password now includes rate-limiting; locked accounts return Err
    let verified = storage::verify_master_password(&conn, password)?;
    eprintln!("[DEBUG] Password verified: {}", verified);

    if !verified {
        storage::log_password_verification(&conn, false)?;
        return Err("Invalid password".to_string());
    }

    storage::log_password_verification(&conn, true)?;

    let salt_str = get_salt(&conn)?;
    eprintln!("[DEBUG] Got salt: {}...", &salt_str[..30.min(salt_str.len())]);
    let salt = SaltString::from_b64(&salt_str)
        .map_err(|e| format!("Invalid salt: {}", e))?;

    eprintln!("[DEBUG] Deriving master key...");
    let master_key = crypto::MasterKey::derive_from_password(password.as_bytes(), &salt)?;
    eprintln!("[DEBUG] Master key derived successfully");

    eprintln!("[DEBUG] Getting encrypted database key...");
    let encrypted_db_key = get_encrypted_db_key(&conn)?;
    eprintln!("[DEBUG] Encrypted key length: {}", encrypted_db_key.len());
    eprintln!("[DEBUG] Decrypting database key...");
    let database_key = crypto::decrypt_data(master_key.as_bytes(), &encrypted_db_key)?;
    eprintln!("[DEBUG] Database key decrypted successfully, length: {}", database_key.len());

    let vault_id = get_vault_id(&conn)?;

    Ok(VaultState {
        vault_id: vault_id.clone(),
        master_key: master_key.to_vec(),
        database_key: database_key.to_vec(),
    })
}

pub fn get_security_questions() -> Result<Vec<SecurityQuestion>, String> {
    let conn = storage::get_connection()?;
    storage::get_security_questions(&conn)
}

/// 验证安全答案，返回恢复的 database_key（由调用方临时存储到 AppState）
pub fn verify_security_answers(answers: &[String]) -> Result<Vec<u8>, String> {
    let conn = storage::get_connection()?;
    let valid = storage::verify_security_answers(&conn, answers)?;
    if !valid {
        return Err("Invalid security answers".to_string());
    }

    let (recovery_salt_str, encrypted_recovery_key) = get_recovery_data(&conn)
        .map_err(|_| "Legacy vault: recovery not supported. You must recreate your vault.".to_string())?;

    let recovery_material = answers.iter()
        .map(|a| a.trim().to_lowercase())
        .collect::<Vec<_>>()
        .join("|");
    let recovery_salt = SaltString::from_b64(&recovery_salt_str).map_err(|e| format!("Invalid recovery salt: {}", e))?;

    let recovery_key = crypto::MasterKey::derive_from_password(recovery_material.as_bytes(), &recovery_salt)?;
    let database_key = crypto::decrypt_data(recovery_key.as_bytes(), &encrypted_recovery_key)?;

    Ok(database_key)
}

/// 使用恢复的 database_key 重置密码
pub fn reset_password(new_password: &str, database_key: &[u8]) -> Result<(), String> {
    let conn = storage::get_connection()?;

    let salt = SaltString::generate(&mut OsRng);
    let new_hash = crypto::hash_password(new_password.as_bytes(), &salt)?;

    let new_master_key = crypto::MasterKey::derive_from_password(new_password.as_bytes(), &salt)?;
    let new_encrypted_db_key = crypto::encrypt_data(new_master_key.as_bytes(), database_key)?;

    storage::update_master_password(&conn, &new_hash, &salt.to_string())?;
    save_encrypted_db_key(&conn, &new_encrypted_db_key)?;

    Ok(())
}

pub fn clear_all_data_authenticated(password: &str) -> Result<(), String> {
    {
        let conn = storage::get_connection()?;
        if !storage::verify_master_password(&conn, password)? {
            return Err("主密码不正确".to_string());
        }
    }
    storage::clear_all_data()
}

/// 修改密码，返回新的 master_key 字节（由调用方更新 AppState）
pub fn change_password(current_password: &str, new_password: &str) -> Result<Vec<u8>, String> {
    let conn = storage::get_connection()?;

    if !storage::verify_master_password(&conn, current_password)? {
        return Err("当前密码不正确".to_string());
    }

    let old_salt_str = get_salt(&conn)?;
    let old_salt = SaltString::from_b64(&old_salt_str).map_err(|e| e.to_string())?;
    let old_master_key = crypto::MasterKey::derive_from_password(current_password.as_bytes(), &old_salt)?;
    let encrypted_db_key = get_encrypted_db_key(&conn)?;
    let database_key = crypto::decrypt_data(old_master_key.as_bytes(), &encrypted_db_key)?;

    let new_salt = SaltString::generate(&mut OsRng);
    let new_hash = crypto::hash_password(new_password.as_bytes(), &new_salt)?;

    let new_master_key = crypto::MasterKey::derive_from_password(new_password.as_bytes(), &new_salt)?;
    let new_encrypted_db_key = crypto::encrypt_data(new_master_key.as_bytes(), &database_key)?;

    storage::update_master_password(&conn, &new_hash, &new_salt.to_string())?;
    save_encrypted_db_key(&conn, &new_encrypted_db_key)?;

    // 返回新 master_key 供调用方更新 AppState
    Ok(new_master_key.to_vec())
}

pub fn update_security_questions(password: &str, questions: &[SecurityQuestion]) -> Result<(), String> {
    let conn = storage::get_connection()?;

    if !storage::verify_master_password(&conn, password)? {
        return Err("当前密码不正确".to_string());
    }

    let salt_str = get_salt(&conn)?;
    let salt = SaltString::from_b64(&salt_str).map_err(|e| e.to_string())?;
    let master_key = crypto::MasterKey::derive_from_password(password.as_bytes(), &salt)?;
    let encrypted_db_key = get_encrypted_db_key(&conn)?;
    let database_key = crypto::decrypt_data(master_key.as_bytes(), &encrypted_db_key)?;

    conn.execute("DELETE FROM security_questions", [])
        .map_err(|e| format!("Failed to clear old security questions: {}", e))?;
    storage::save_security_questions(&conn, questions)?;

    let recovery_material = questions.iter()
        .map(|q| q.answer.trim().to_lowercase())
        .collect::<Vec<_>>()
        .join("|");
    let recovery_salt = SaltString::generate(&mut OsRng);
    let recovery_key = crypto::MasterKey::derive_from_password(recovery_material.as_bytes(), &recovery_salt)?;

    let encrypted_recovery_key = crypto::encrypt_data(recovery_key.as_bytes(), &database_key)?;
    save_recovery_data(&conn, &recovery_salt.to_string(), &encrypted_recovery_key)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn get_salt(conn: &rusqlite::Connection) -> Result<String, String> {
    let salt = conn
        .query_row(
            "SELECT salt FROM master_password WHERE id = 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| format!("Failed to get salt: {}", e))?;
    Ok(salt)
}

fn get_encrypted_db_key(conn: &rusqlite::Connection) -> Result<Vec<u8>, String> {
    let encrypted_key = conn
        .query_row(
            "SELECT encrypted_key FROM vault_keys WHERE id = 1",
            [],
            |row| row.get::<_, Vec<u8>>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to query encrypted key: {}", e))?;

    match encrypted_key {
        Some(key) => {
            eprintln!("[DEBUG] Found encrypted key in database, length: {}", key.len());
            Ok(key)
        }
        None => {
            eprintln!("[DEBUG] No encrypted key found in database");
            Err("Encrypted database key not found. Please recreate the vault.".to_string())
        }
    }
}

fn save_encrypted_db_key(conn: &rusqlite::Connection, encrypted_key: &[u8]) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO vault_keys (id, encrypted_key) VALUES (1, ?)",
        [encrypted_key],
    )
    .map_err(|e| format!("Failed to save encrypted key: {}", e))?;
    Ok(())
}

fn save_recovery_data(conn: &rusqlite::Connection, salt: &str, encrypted_key: &[u8]) -> Result<(), String> {
    let _ = conn.execute("ALTER TABLE vault_config ADD COLUMN recovery_salt TEXT", []);

    conn.execute(
        "UPDATE vault_config SET recovery_salt = ? WHERE id = 1",
        rusqlite::params![salt],
    )
    .map_err(|e| format!("Failed to save recovery salt: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO vault_keys (id, encrypted_key) VALUES (2, ?)",
        [encrypted_key],
    )
    .map_err(|e| format!("Failed to save encrypted recovery key: {}", e))?;

    Ok(())
}

fn get_recovery_data(conn: &rusqlite::Connection) -> Result<(String, Vec<u8>), String> {
    let salt = conn
        .query_row(
            "SELECT recovery_salt FROM vault_config WHERE id = 1",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(|e| format!("Failed to get recovery salt: {}", e))?
        .ok_or_else(|| "Recovery salt not set".to_string())?;

    let encrypted_key = conn
        .query_row(
            "SELECT encrypted_key FROM vault_keys WHERE id = 2",
            [],
            |row| row.get::<_, Vec<u8>>(0),
        )
        .map_err(|e| format!("Failed to get encrypted recovery key: {}", e))?;

    Ok((salt, encrypted_key))
}

fn get_vault_id(conn: &rusqlite::Connection) -> Result<String, String> {
    let id = conn
        .query_row(
            "SELECT vault_id FROM vault_config WHERE id = 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to get vault ID: {}", e))?;

    match id {
        Some(id) => Ok(id),
        None => {
            let new_id = crypto::generate_secure_id();
            conn.execute(
                "INSERT INTO vault_config (id, vault_id) VALUES (1, ?)",
                [&new_id],
            )
            .map_err(|e| format!("Failed to save vault ID: {}", e))?;
            Ok(new_id)
        }
    }
}

fn create_default_categories(conn: &rusqlite::Connection) -> Result<(), String> {
    let default_categories = vec![
        Category {
            id: crypto::generate_secure_id(),
            name: "Social".to_string(),
            icon: "👥".to_string(),
            color: "#8b5cf6".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
        Category {
            id: crypto::generate_secure_id(),
            name: "Email".to_string(),
            icon: "📧".to_string(),
            color: "#ec4899".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
        Category {
            id: crypto::generate_secure_id(),
            name: "Finance".to_string(),
            icon: "💰".to_string(),
            color: "#22c55e".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
        Category {
            id: crypto::generate_secure_id(),
            name: "Work".to_string(),
            icon: "💼".to_string(),
            color: "#3b82f6".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
        Category {
            id: crypto::generate_secure_id(),
            name: "Entertainment".to_string(),
            icon: "🎮".to_string(),
            color: "#f97316".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
    ];

    for category in default_categories {
        conn.execute(
            "INSERT INTO categories (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![
                &category.id,
                &category.name,
                &category.icon,
                &category.color,
                category.created_at,
            ],
        )
        .map_err(|e| format!("Failed to create default category: {}", e))?;
    }

    Ok(())
}
