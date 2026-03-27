use crate::types::*;
use crate::entry_api;
use crate::category_api;
use std::collections::HashMap;

pub fn export_data(state: &VaultState, format: &str) -> Result<String, String> {
    let entries = entry_api::list_entries(state)?;
    let categories = category_api::list_categories(state)?;

    match format {
        "json" => {
            let export_data = serde_json::json!({
                "entries": entries,
                "categories": categories,
                "exported_at": chrono::Utc::now().to_rfc3339(),
            });

            Ok(export_data.to_string())
        }
        "csv" => {
            // Export entries as CSV
            let mut csv = String::from("title,username,password,url,notes,category,favorite,created_at,updated_at\n");

            for entry in entries {
                let category_name = if let Some(cat) = categories.iter().find(|c| c.id == entry.category_id) {
                    &cat.name
                } else {
                    ""
                };

                csv.push_str(&format!(
                    "{},{},{},{},{},{},{},{},{}\n",
                    escape_csv(&entry.title),
                    escape_csv(&entry.username),
                    escape_csv(&entry.password),
                    escape_csv(&entry.url),
                    escape_csv(&entry.notes),
                    escape_csv(category_name),
                    entry.favorite,
                    entry.created_at,
                    entry.updated_at
                ));
            }

            Ok(csv)
        }
        _ => Err("Unsupported format".to_string()),
    }
}

pub fn import_data(state: &mut VaultState, data: &str, format: &str) -> Result<(), String> {
    eprintln!("[DEBUG] import_data called, format: {}", format);

    match format {
        "json" => {
            eprintln!("[DEBUG] Importing as JSON");
            import_json(state, data)
        }
        "csv" => {
            eprintln!("[DEBUG] Importing as CSV");
            import_csv(state, data)
        }
        _ => {
            eprintln!("[DEBUG] Unsupported format: {}", format);
            Err("Unsupported format".to_string())
        }
    }
}

fn import_json(state: &mut VaultState, data: &str) -> Result<(), String> {
    eprintln!("[DEBUG] import_json called, data length: {}", data.len());

    let import_data: serde_json::Value = serde_json::from_str(data)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    eprintln!("[DEBUG] JSON parsed successfully");

    // Build category ID mapping: old_id -> new_id
    let mut category_id_map: HashMap<String, String> = HashMap::new();

    // Import categories first
    if let Some(categories) = import_data.get("categories").and_then(|v| v.as_array()) {
        eprintln!("[DEBUG] Found {} categories in import data", categories.len());

        let existing_categories = category_api::list_categories(state)?;
        for cat_value in categories {
            match serde_json::from_value::<Category>(cat_value.clone()) {
                Ok(cat) => {
                    // Check if category already exists by name
                    let existing = existing_categories
                        .iter()
                        .find(|c| c.name == cat.name);

                    let new_id = if let Some(existing_cat) = existing {
                        // Use existing category ID
                        eprintln!("[DEBUG] Category {} already exists with id: {}, using existing", cat.name, existing_cat.id);
                        existing_cat.id.clone()
                    } else {
                        // Create new category
                        eprintln!("[DEBUG] Creating new category: {}", cat.name);
                        let create = CategoryCreate {
                            name: cat.name.clone(),
                            icon: cat.icon,
                            color: cat.color,
                        };
                        match category_api::create_category(state, create) {
                            Ok(new_id) => {
                                eprintln!("[DEBUG] Category {} created with id: {}", cat.name, new_id);
                                new_id
                            }
                            Err(e) => {
                                eprintln!("[DEBUG] Failed to create category '{}': {}", cat.name, e);
                                return Err(format!("Failed to create category '{}': {}", cat.name, e));
                            }
                        }
                    };

                    // Map old ID to new ID
                    category_id_map.insert(cat.id.clone(), new_id);
                }
                Err(e) => {
                    eprintln!("[DEBUG] Failed to deserialize category: {}", e);
                    return Err(format!("Failed to deserialize category: {}", e));
                }
            }
        }
    }

    eprintln!("[DEBUG] Category ID mapping: {:?}", category_id_map);

    // Import entries
    if let Some(entries) = import_data.get("entries").and_then(|v| v.as_array()) {
        eprintln!("[DEBUG] Found {} entries in import data", entries.len());

        for (index, entry_value) in entries.iter().enumerate() {
            eprintln!("[DEBUG] Processing entry {}/{}", index + 1, entries.len());

            match serde_json::from_value::<Entry>(entry_value.clone()) {
                Ok(entry) => {
                    eprintln!("[DEBUG] Creating entry: {}", entry.title);

                    let entry_title = entry.title.clone();

                    // Map category ID
                    let new_category_id = if !entry.category_id.is_empty() {
                        category_id_map.get(&entry.category_id).cloned().unwrap_or_else(|| {
                            eprintln!("[DEBUG] Category ID {} not found in mapping, using empty", entry.category_id);
                            String::new()
                        })
                    } else {
                        String::new()
                    };

                    let create = EntryCreate {
                        title: entry.title,
                        username: entry.username,
                        password: entry.password,
                        url: entry.url,
                        notes: entry.notes,
                        category_id: new_category_id,
                        favorite: entry.favorite,
                    };

                    match entry_api::create_entry(state, create) {
                        Ok(_) => {
                            eprintln!("[DEBUG] Entry {} created successfully", entry_title);
                        }
                        Err(e) => {
                            eprintln!("[DEBUG] Failed to create entry '{}': {}", entry_title, e);
                            return Err(format!("Failed to create entry '{}': {}", entry_title, e));
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[DEBUG] Failed to deserialize entry {}: {}", index + 1, e);
                    eprintln!("[DEBUG] Entry value: {}", entry_value);
                    return Err(format!("Failed to deserialize entry {}: {}", index + 1, e));
                }
            }
        }
    }

    eprintln!("[DEBUG] Import completed successfully");
    Ok(())
}

fn import_csv(state: &mut VaultState, data: &str) -> Result<(), String> {
    eprintln!("[DEBUG] import_csv called, data length: {}", data.len());

    let mut lines = data.lines();
    let line_count = lines.clone().count();
    eprintln!("[DEBUG] CSV has {} lines (including header)", line_count);

    // Skip header
    lines.next();

    let mut categories = category_api::list_categories(state)?;
    eprintln!("[DEBUG] Found {} existing categories", categories.len());

    let mut processed_count = 0;

    for (index, line) in lines.enumerate() {
        if line.trim().is_empty() {
            continue;
        }

        let fields = parse_csv_line(line)?;

        if fields.len() < 9 {
            eprintln!("[DEBUG] Line {} has only {} fields, skipping", index + 2, fields.len());
            continue;
        }

        let title = unescape_csv(&fields[0]);
        let username = unescape_csv(&fields[1]);
        let password = unescape_csv(&fields[2]);
        let url = unescape_csv(&fields[3]);
        let notes = unescape_csv(&fields[4]);
        let category_name = unescape_csv(&fields[5]);
        let favorite: bool = fields[6].parse().unwrap_or(false);
        let _created_at: i64 = fields[7].parse().unwrap_or(chrono::Utc::now().timestamp());
        let _updated_at: i64 = fields[8].parse().unwrap_or(chrono::Utc::now().timestamp());

        eprintln!("[DEBUG] Processing entry: {}", title);

        // Find or create category
        let category_id = if !category_name.is_empty() {
            if let Some(cat) = categories.iter().find(|c| c.name == category_name) {
                eprintln!("[DEBUG] Using existing category: {}", category_name);
                cat.id.clone()
            } else {
                eprintln!("[DEBUG] Creating new category: {}", category_name);
                // Create new category
                let create = CategoryCreate {
                    name: category_name.clone(),
                    icon: "📁".to_string(),
                    color: "#6b7280".to_string(),
                };
                let new_id = category_api::create_category(state, create)?;
                // Update categories list
                categories = category_api::list_categories(state)?;
                eprintln!("[DEBUG] New category created with id: {}", new_id);
                new_id
            }
        } else {
            String::new()
        };

        let entry_title = title.clone();
        let create = EntryCreate {
            title,
            username,
            password,
            url,
            notes,
            category_id,
            favorite,
        };

        entry_api::create_entry(state, create)?;
        processed_count += 1;
        eprintln!("[DEBUG] Entry {} created successfully", entry_title);
    }

    eprintln!("[DEBUG] CSV import completed, processed {} entries", processed_count);
    Ok(())
}

fn escape_csv(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

fn unescape_csv(s: &str) -> String {
    if s.starts_with('"') && s.ends_with('"') {
        s[1..s.len()-1].replace("\"\"", "\"")
    } else {
        s.to_string()
    }
}

fn parse_csv_line(line: &str) -> Result<Vec<String>, String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '"' => {
                if in_quotes && chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = !in_quotes;
                }
            }
            ',' if !in_quotes => {
                fields.push(current);
                current = String::new();
            }
            _ => {
                current.push(c);
            }
        }
    }

    fields.push(current);
    Ok(fields)
}
