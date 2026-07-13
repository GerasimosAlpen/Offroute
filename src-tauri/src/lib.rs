mod commands;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {} aku sontoloyo", name)
}

fn build_stronghold() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    use argon2::{Algorithm, Argon2, Params, Version};
    tauri_plugin_stronghold::Builder::new(|password| {
        let params = Params::new(19456, 2, 1, Some(32)).expect("invalid argon2 params");
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        // Salt should be device-specific in production; swap with a persisted random salt
        let salt = b"offroute-key-v01";
        let mut key = vec![0u8; 32];
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .expect("argon2 key derivation failed");
        key
    })
    .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(build_stronghold())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![greet, commands::device::emit_test_event])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
