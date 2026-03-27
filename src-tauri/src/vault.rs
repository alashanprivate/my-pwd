use argon2::password_hash::{SaltString, rand_core::OsRng};
use std::sync::Mutex;
use crate::types::*;
use crate::crypto;
use crate::storage;
use rusqlite::OptionalExtension;

// Store vault state in memory
static VAULT_STATE: Mutex<Option<VaultState>> = Mutex::new(None);
// Store recovered DB key temporarily during reset flow
static RECOVERY_DB_KEY: Mutex<Option<Vec<u8>>> = Mutex::new(None);

pub fn create_vault(password: &str, security_questions: &[SecurityQuestion]) -> Result<(), String> {
    // Generate salt
    let salt = SaltString::generate(&mut OsRng);

    // Hash password
    let password_hash = crypto::hash_password(password.as_bytes(), &salt)?;

    // Create database
    let conn = storage::create_connection()?;
    storage::init_database(&conn)?;

    // Save master password
    storage::save_master_password(&conn, &password_hash, &salt.to_string())?;

    // Save security questions
    storage::save_security_questions(&conn, security_questions)?;

    // Create default categories
    create_default_categories(&conn)?;

    // Generate and store vault keys
    let vault_id = get_vault_id(&conn)?;
    let master_key = crypto::MasterKey::derive_from_password(password.as_bytes(), &salt)?;
    let database_key = crypto::MasterKey::generate_random();

    // Save encrypted database key
    let encrypted_db_key = crypto::encrypt_data(master_key.as_bytes(), database_key.as_bytes())?;
    save_encrypted_db_key(&conn, &encrypted_db_key)?;

    // Create and save recovery key from security answers
    let recovery_material = security_questions.iter()
        .map(|q| q.answer.trim().to_lowercase())
        .collect::<Vec<_>>()
        .join("|");
    let recovery_salt = SaltString::generate(&mut OsRng);
    let recovery_key = crypto::MasterKey::derive_from_password(recovery_material.as_bytes(), &recovery_salt)?;
    let encrypted_recovery_key = crypto::encrypt_data(recovery_key.as_bytes(), database_key.as_bytes())?;
    save_recovery_data(&conn, &recovery_salt.to_string(), &encrypted_recovery_key)?;

    // Store state
    {
        let mut state = VAULT_STATE.lock().unwrap();
        *state = Some(VaultState {
            vault_id: vault_id.clone(),
            master_key: master_key.to_vec(),
            database_key: database_key.to_vec(),
        });
    }

    Ok(())
}

pub fn unlock_vault(password: &str) -> Result<VaultState, String> {
    eprintln!("[DEBUG] unlock_vault called with password length: {}", password.len());

    let conn = storage::get_connection()?;

    // Verify password
    let verified = storage::verify_master_password(&conn, password)?;
    eprintln!("[DEBUG] Password verified: {}", verified);

    if !verified {
        storage::log_password_verification(&conn, false)?;
        return Err("Invalid password".to_string());
    }

    storage::log_password_verification(&conn, true)?;

    // Get salt for deriving master key
    let salt_str = get_salt(&conn)?;
    eprintln!("[DEBUG] Got salt: {}...", &salt_str[..30.min(salt_str.len())]);
    let salt = SaltString::from_b64(&salt_str)
        .map_err(|e| format!("Invalid salt: {}", e))?;

    // Derive master key
    eprintln!("[DEBUG] Deriving master key...");
    let master_key = crypto::MasterKey::derive_from_password(password.as_bytes(), &salt)?;
    eprintln!("[DEBUG] Master key derived successfully");

    // Get and decrypt database key
    eprintln!("[DEBUG] Getting encrypted database key...");
    let encrypted_db_key = get_encrypted_db_key(&conn)?;
    eprintln!("[DEBUG] Encrypted key length: {}", encrypted_db_key.len());
    eprintln!("[DEBUG] Decrypting database key...");
    let database_key = crypto::decrypt_data(master_key.as_bytes(), &encrypted_db_key)?;
    eprintln!("[DEBUG] Database key decrypted successfully, length: {}", database_key.len());

    // Get vault ID
    let vault_id = get_vault_id(&conn)?;

    // Store state
    let state = VaultState {
        vault_id: vault_id.clone(),
        master_key: master_key.to_vec(),
        database_key: database_key.to_vec(),
    };

    {
        let mut global_state = VAULT_STATE.lock().unwrap();
        *global_state = Some(state.clone());
    }

    Ok(state)
}

pub fn lock_vault() -> Result<(), String> {
    let mut state = VAULT_STATE.lock().unwrap();
    *state = None;
    Ok(())
}


pub fn get_security_questions() -> Result<Vec<SecurityQuestion>, String> {
    let conn = storage::get_connection()?;
    storage::get_security_questions(&conn)
}

pub fn verify_security_answers(answers: &[String]) -> Result<(), String> {
    let conn = storage::get_connection()?;
    let valid = storage::verify_security_answers(&conn, answers)?;
    if !valid {
        return Err("Invalid security answers".to_string());
    }

    // Recover the database key using the answers
    let (recovery_salt_str, encrypted_recovery_key) = get_recovery_data(&conn)
        .map_err(|_| "Legacy vault: recovery not supported. You must recreate your vault.".to_string())?;

    let recovery_material = answers.iter()
        .map(|a| a.trim().to_lowercase())
        .collect::<Vec<_>>()
        .join("|");
    let recovery_salt = SaltString::from_b64(&recovery_salt_str).map_err(|e| format!("Invalid recovery salt: {}", e))?;
    
    let recovery_key = crypto::MasterKey::derive_from_password(recovery_material.as_bytes(), &recovery_salt)?;
    let database_key = crypto::decrypt_data(recovery_key.as_bytes(), &encrypted_recovery_key)?;

    // Store recovered database key in memory
    {
        let mut key_state = RECOVERY_DB_KEY.lock().unwrap();
        *key_state = Some(database_key);
    }

    Ok(())
}

pub fn reset_password(new_password: &str) -> Result<(), String> {
    let database_key = {
        let mut key_state = RECOVERY_DB_KEY.lock().unwrap();
        key_state.take().ok_or_else(|| "No recovery session active".to_string())?
    };

    let conn = storage::get_connection()?;
    
    // Generate new salt and hash for master password
    let salt = SaltString::generate(&mut OsRng);
    let new_hash = crypto::hash_password(new_password.as_bytes(), &salt)?;

    // Derive new master key
    let new_master_key = crypto::MasterKey::derive_from_password(new_password.as_bytes(), &salt)?;
    
    // Encrypt database key with new master key
    let new_encrypted_db_key = crypto::encrypt_data(new_master_key.as_bytes(), &database_key)?;

    // Save changes
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
        // conn 离开此代码块后将自动关闭连接
    }
    storage::clear_all_data()
}

pub fn change_password(current_password: &str, new_password: &str) -> Result<(), String> {
    let conn = storage::get_connection()?;
    
    // Verify current password
    if !storage::verify_master_password(&conn, current_password)? {
        return Err("当前密码不正确".to_string());
    }

    // Derive old master key and decrypt db key
    let old_salt_str = get_salt(&conn)?;
    let old_salt = SaltString::from_b64(&old_salt_str).map_err(|e| e.to_string())?;
    let old_master_key = crypto::MasterKey::derive_from_password(current_password.as_bytes(), &old_salt)?;
    let encrypted_db_key = get_encrypted_db_key(&conn)?;
    let database_key = crypto::decrypt_data(old_master_key.as_bytes(), &encrypted_db_key)?;

    // Generate new salt and new hash for master password
    let new_salt = SaltString::generate(&mut OsRng);
    let new_hash = crypto::hash_password(new_password.as_bytes(), &new_salt)?;

    // Derive new master key and re-encrypt the database key
    let new_master_key = crypto::MasterKey::derive_from_password(new_password.as_bytes(), &new_salt)?;
    let new_encrypted_db_key = crypto::encrypt_data(new_master_key.as_bytes(), &database_key)?;

    storage::update_master_password(&conn, &new_hash, &new_salt.to_string())?;
    save_encrypted_db_key(&conn, &new_encrypted_db_key)?;

    // Update in-memory key state optionally
    if let Ok(mut global_state) = VAULT_STATE.lock() {
        if let Some(state) = global_state.as_mut() {
            state.master_key = new_master_key.to_vec();
        }
    }

    Ok(())
}

pub fn update_security_questions(password: &str, questions: &[SecurityQuestion]) -> Result<(), String> {
    let conn = storage::get_connection()?;
    
    // Verify password to authorize this action
    if !storage::verify_master_password(&conn, password)? {
        return Err("当前密码不正确".to_string());
    }

    // Get old key and decrypt database key
    let salt_str = get_salt(&conn)?;
    let salt = SaltString::from_b64(&salt_str).map_err(|e| e.to_string())?;
    let master_key = crypto::MasterKey::derive_from_password(password.as_bytes(), &salt)?;
    let encrypted_db_key = get_encrypted_db_key(&conn)?;
    let database_key = crypto::decrypt_data(master_key.as_bytes(), &encrypted_db_key)?;

    // 1. Delete all old questions and save new ones
    conn.execute("DELETE FROM security_questions", [])
        .map_err(|e| format!("Failed to clear old security questions: {}", e))?;
    storage::save_security_questions(&conn, questions)?;

    // 2. Generate new recovery key using the new security answers and save it
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

fn generate_vault_id() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 16];
    let mut rng = rand::thread_rng();
    rng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

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
    // Read the encrypted key from database
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
    // 兼容旧数据库的容错处理
    let _ = conn.execute("ALTER TABLE vault_config ADD COLUMN recovery_salt TEXT", []);
    
    conn.execute(
        "UPDATE vault_config SET recovery_salt = ? WHERE id = 1",
        params![salt],
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
    // Check if vault ID exists
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
            // Generate new vault ID
            let new_id = generate_vault_id();

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
            id: generate_id(),
            name: "Social".to_string(),
            icon: "👥".to_string(),
            color: "#8b5cf6".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
        Category {
            id: generate_id(),
            name: "Email".to_string(),
            icon: "📧".to_string(),
            color: "#ec4899".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
        Category {
            id: generate_id(),
            name: "Finance".to_string(),
            icon: "💰".to_string(),
            color: "#22c55e".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
        Category {
            id: generate_id(),
            name: "Work".to_string(),
            icon: "💼".to_string(),
            color: "#3b82f6".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
        Category {
            id: generate_id(),
            name: "Entertainment".to_string(),
            icon: "🎮".to_string(),
            color: "#f97316".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        },
    ];

    for category in default_categories {
        conn.execute(
            "INSERT INTO categories (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)",
            params![
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

fn generate_id() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 16];
    let mut rng = rand::thread_rng();
    rng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

use rusqlite::params;
