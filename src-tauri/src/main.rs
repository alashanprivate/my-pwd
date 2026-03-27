// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod crypto;
mod storage;
mod vault;
mod entry_api;
mod category_api;
mod settings_api;
mod types;

use tauri::State;
use std::sync::Mutex;
use types::*;

struct AppState(Mutex<Option<VaultState>>);

#[tauri::command]
async fn check_vault_setup(state: State<'_, AppState>) -> Result<bool, String> {
    let _app_state = state.0.lock().unwrap();
    Ok(storage::check_vault_exists())
}

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

#[tauri::command]
async fn lock_vault(state: State<'_, AppState>) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    *app_state = None;
    Ok(())
}

#[tauri::command]
async fn get_security_questions() -> Result<Vec<SecurityQuestion>, String> {
    vault::get_security_questions()
}

#[tauri::command]
async fn verify_security_answers(answers: Vec<String>) -> Result<(), String> {
    vault::verify_security_answers(&answers)
}

#[tauri::command]
async fn reset_password(new_password: String) -> Result<(), String> {
    vault::reset_password(&new_password)
}

#[tauri::command]
async fn change_password(
    current_password: String,
    new_password: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let _app_state = state.0.lock().unwrap();
    if _app_state.is_none() {
        return Err("Vault not unlocked".to_string());
    }
    vault::change_password(&current_password, &new_password)
}

#[tauri::command]
async fn update_security_questions(
    password: String,
    questions: Vec<SecurityQuestion>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let _app_state = state.0.lock().unwrap();
    if _app_state.is_none() {
        return Err("Vault not unlocked".to_string());
    }
    vault::update_security_questions(&password, &questions)
}

#[tauri::command]
async fn list_entries(state: State<'_, AppState>) -> Result<Vec<Entry>, String> {
    let app_state = state.0.lock().unwrap();
    match &*app_state {
        Some(state) => entry_api::list_entries(state),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn create_entry(
    entry: EntryCreate,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut app_state = state.0.lock().unwrap();
    match &mut *app_state {
        Some(state) => entry_api::create_entry(state, entry),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn update_entry(
    id: String,
    entry: EntryUpdate,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    match &mut *app_state {
        Some(state) => entry_api::update_entry(state, &id, entry),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn delete_entry(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    match &mut *app_state {
        Some(state) => entry_api::delete_entry(state, &id),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn restore_entry(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    match &mut *app_state {
        Some(state) => entry_api::restore_entry(state, &id),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn list_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    let app_state = state.0.lock().unwrap();
    match &*app_state {
        Some(state) => category_api::list_categories(state),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn create_category(
    category: CategoryCreate,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut app_state = state.0.lock().unwrap();
    match &mut *app_state {
        Some(state) => category_api::create_category(state, category),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn update_category(
    id: String,
    category: CategoryUpdate,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    match &mut *app_state {
        Some(state) => category_api::update_category(state, &id, category),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn delete_category(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut app_state = state.0.lock().unwrap();
    match &mut *app_state {
        Some(state) => category_api::delete_category(state, &id),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn export_data(format: String, state: State<'_, AppState>) -> Result<String, String> {
    let app_state = state.0.lock().unwrap();
    match &*app_state {
        Some(state) => settings_api::export_data(state, &format),
        None => Err("Vault not unlocked".to_string()),
    }
}

#[tauri::command]
async fn import_data(
    data: String,
    format: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    eprintln!("[DEBUG] import_data command called, format: {}, data length: {}", format, data.len());

    let mut app_state = state.0.lock().unwrap();
    match &mut *app_state {
        Some(state) => {
            eprintln!("[DEBUG] Vault state found, calling import_data");
            let result = settings_api::import_data(state, &data, &format);
            eprintln!("[DEBUG] import_data result: {:?}", result);
            result
        },
        None => {
            eprintln!("[DEBUG] No vault state found");
            Err("Vault not unlocked".to_string())
        },
    }
}

#[tauri::command]
async fn clear_all_data(password: String) -> Result<(), String> {
    vault::clear_all_data_authenticated(&password)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            check_vault_setup,
            create_vault,
            unlock_vault,
            lock_vault,
            get_security_questions,
            verify_security_answers,
            reset_password,
            change_password,
            update_security_questions,
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
