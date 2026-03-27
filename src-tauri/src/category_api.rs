use rusqlite::params;
use crate::types::*;
use crate::storage;

pub fn list_categories(_state: &VaultState) -> Result<Vec<Category>, String> {
    let conn = storage::get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, created_at FROM categories"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let categories = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to query categories: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect categories: {}", e))?;

    Ok(categories)
}

pub fn create_category(_state: &mut VaultState, category: CategoryCreate) -> Result<String, String> {
    let id = generate_id();
    let now = chrono::Utc::now().timestamp();

    let conn = storage::get_connection()?;

    conn.execute(
        "INSERT INTO categories (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)",
        params![
            &id,
            &category.name,
            &category.icon,
            &category.color,
            now,
        ],
    )
    .map_err(|e| format!("Failed to create category: {}", e))?;

    storage::log_audit(&conn, "create_category", Some(format!("Category ID: {}", id)))?;

    Ok(id)
}

pub fn update_category(_state: &mut VaultState, id: &str, category: CategoryUpdate) -> Result<(), String> {
    let conn = storage::get_connection()?;

    let name = category.name.unwrap_or_default();
    let icon = category.icon.unwrap_or_default();
    let color = category.color.unwrap_or_default();

    conn.execute(
        "UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?",
        params![name, icon, color, id],
    )
    .map_err(|e| format!("Failed to update category: {}", e))?;

    storage::log_audit(&conn, "update_category", Some(format!("Category ID: {}", id)))?;

    Ok(())
}

pub fn delete_category(_state: &VaultState, id: &str) -> Result<(), String> {
    let conn = storage::get_connection()?;

    // Check if category has any entries
    let entry_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM entries WHERE category_id = ? AND deleted = 0",
            [id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check entries: {}", e))?;

    if entry_count > 0 {
        return Err(format!("Cannot delete category: it has {} associated entries", entry_count));
    }

    // Delete the category
    conn.execute(
        "DELETE FROM categories WHERE id = ?",
        [id],
    )
    .map_err(|e| format!("Failed to delete category: {}", e))?;

    storage::log_audit(&conn, "delete_category", Some(format!("Category ID: {}", id)))?;

    Ok(())
}

fn generate_id() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 16];
    let mut rng = rand::thread_rng();
    rng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}
