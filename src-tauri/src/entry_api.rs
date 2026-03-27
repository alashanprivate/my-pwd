use rusqlite::{params, Connection};
use crate::types::*;
use crate::crypto;
use crate::storage;

pub fn list_entries(state: &VaultState) -> Result<Vec<Entry>, String> {
    let conn = storage::get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, title, username, password, url, notes, category_id, favorite, created_at, updated_at, deleted
         FROM entries"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let entries = stmt
        .query_map([], |row| {
            let encrypted_title = row.get::<_, Vec<u8>>(1)?;
            let encrypted_username = row.get::<_, Vec<u8>>(2)?;
            let encrypted_password = row.get::<_, Vec<u8>>(3)?;
            let encrypted_url = row.get::<_, Vec<u8>>(4)?;
            let encrypted_notes = row.get::<_, Vec<u8>>(5)?;

            let title_bytes = crypto::decrypt_data(&state.database_key, &encrypted_title)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let username_bytes = crypto::decrypt_data(&state.database_key, &encrypted_username)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let password_bytes = crypto::decrypt_data(&state.database_key, &encrypted_password)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let url_bytes = crypto::decrypt_data(&state.database_key, &encrypted_url)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let notes_bytes = crypto::decrypt_data(&state.database_key, &encrypted_notes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;

            let title = String::from_utf8(title_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let username = String::from_utf8(username_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let password = String::from_utf8(password_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let url = String::from_utf8(url_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let notes = String::from_utf8(notes_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;

            Ok(Entry {
                id: row.get(0)?,
                title,
                username,
                password,
                url,
                notes,
                category_id: row.get(6)?,
                favorite: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                deleted: row.get::<_, i32>(10)? != 0,
            })
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect entries: {}", e))?;

    Ok(entries)
}

pub fn create_entry(state: &mut VaultState, entry: EntryCreate) -> Result<String, String> {
    let id = generate_id();
    let now = chrono::Utc::now().timestamp();

    let encrypted_title = crypto::encrypt_data(&state.database_key, entry.title.as_bytes())?;
    let encrypted_username = crypto::encrypt_data(&state.database_key, entry.username.as_bytes())?;
    let encrypted_password = crypto::encrypt_data(&state.database_key, entry.password.as_bytes())?;
    let encrypted_url = crypto::encrypt_data(&state.database_key, entry.url.as_bytes())?;
    let encrypted_notes = crypto::encrypt_data(&state.database_key, entry.notes.as_bytes())?;

    let conn = storage::get_connection()?;

    conn.execute(
        "INSERT INTO entries (id, title, username, password, url, notes, category_id, favorite, created_at, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
        params![
            &id,
            encrypted_title,
            encrypted_username,
            encrypted_password,
            encrypted_url,
            encrypted_notes,
            &entry.category_id,
            entry.favorite as i32,
            now,
            now,
        ],
    )
    .map_err(|e| format!("Failed to create entry: {}", e))?;

    storage::log_audit(&conn, "create_entry", Some(format!("Entry ID: {}", id)))?;

    Ok(id)
}

pub fn update_entry(state: &mut VaultState, id: &str, entry: EntryUpdate) -> Result<(), String> {
    let conn = storage::get_connection()?;

    // Get existing entry
    let existing = get_entry_by_id(&conn, state, id)?;

    let title = entry.title.unwrap_or(existing.title);
    let username = entry.username.unwrap_or(existing.username);
    let password = entry.password.unwrap_or(existing.password);
    let url = entry.url.unwrap_or(existing.url);
    let notes = entry.notes.unwrap_or(existing.notes);
    let category_id = entry.category_id.unwrap_or(existing.category_id);
    let favorite = entry.favorite.unwrap_or(existing.favorite);

    let encrypted_title = crypto::encrypt_data(&state.database_key, title.as_bytes())?;
    let encrypted_username = crypto::encrypt_data(&state.database_key, username.as_bytes())?;
    let encrypted_password = crypto::encrypt_data(&state.database_key, password.as_bytes())?;
    let encrypted_url = crypto::encrypt_data(&state.database_key, url.as_bytes())?;
    let encrypted_notes = crypto::encrypt_data(&state.database_key, notes.as_bytes())?;

    conn.execute(
        "UPDATE entries SET title = ?, username = ?, password = ?, url = ?, notes = ?, category_id = ?, favorite = ?, updated_at = ? WHERE id = ?",
        params![
            encrypted_title,
            encrypted_username,
            encrypted_password,
            encrypted_url,
            encrypted_notes,
            category_id,
            favorite as i32,
            chrono::Utc::now().timestamp(),
            id,
        ],
    )
    .map_err(|e| format!("Failed to update entry: {}", e))?;

    storage::log_audit(&conn, "update_entry", Some(format!("Entry ID: {}", id)))?;

    Ok(())
}

pub fn delete_entry(_state: &VaultState, id: &str) -> Result<(), String> {
    let conn = storage::get_connection()?;

    conn.execute(
        "UPDATE entries SET deleted = 1, updated_at = ? WHERE id = ?",
        params![chrono::Utc::now().timestamp(), id],
    )
    .map_err(|e| format!("Failed to delete entry: {}", e))?;

    storage::log_audit(&conn, "delete_entry", Some(format!("Entry ID: {}", id)))?;

    Ok(())
}

pub fn restore_entry(_state: &VaultState, id: &str) -> Result<(), String> {
    let conn = storage::get_connection()?;

    conn.execute(
        "UPDATE entries SET deleted = 0, updated_at = ? WHERE id = ?",
        params![chrono::Utc::now().timestamp(), id],
    )
    .map_err(|e| format!("Failed to restore entry: {}", e))?;

    storage::log_audit(&conn, "restore_entry", Some(format!("Entry ID: {}", id)))?;

    Ok(())
}

fn get_entry_by_id(conn: &Connection, state: &VaultState, id: &str) -> Result<Entry, String> {
    conn.query_row(
        "SELECT id, title, username, password, url, notes, category_id, favorite, created_at, updated_at, deleted
         FROM entries WHERE id = ?",
        [id],
        |row| {
            let encrypted_title = row.get::<_, Vec<u8>>(1)?;
            let encrypted_username = row.get::<_, Vec<u8>>(2)?;
            let encrypted_password = row.get::<_, Vec<u8>>(3)?;
            let encrypted_url = row.get::<_, Vec<u8>>(4)?;
            let encrypted_notes = row.get::<_, Vec<u8>>(5)?;

            let title_bytes = crypto::decrypt_data(&state.database_key, &encrypted_title)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let username_bytes = crypto::decrypt_data(&state.database_key, &encrypted_username)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let password_bytes = crypto::decrypt_data(&state.database_key, &encrypted_password)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let url_bytes = crypto::decrypt_data(&state.database_key, &encrypted_url)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let notes_bytes = crypto::decrypt_data(&state.database_key, &encrypted_notes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;

            let title = String::from_utf8(title_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let username = String::from_utf8(username_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let password = String::from_utf8(password_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let url = String::from_utf8(url_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;
            let notes = String::from_utf8(notes_bytes)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(e.into()))?;

            Ok(Entry {
                id: row.get(0)?,
                title,
                username,
                password,
                url,
                notes,
                category_id: row.get(6)?,
                favorite: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                deleted: row.get::<_, i32>(10)? != 0,
            })
        }
    )
    .map_err(|e| format!("Failed to get entry: {}", e))
}

fn generate_id() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 16];
    let mut rng = rand::thread_rng();
    rng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}
