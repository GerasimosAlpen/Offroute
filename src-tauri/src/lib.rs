mod commands;

// Demo-playground IPC smoke test (TauriCard.tsx) — proves the invoke bridge works.
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

/* 
fn build_stronghold() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    use argon2::{Algorithm, Argon2, Params, Version};
    tauri_plugin_stronghold::Builder::new(|password| {
        let params = Params::new(19456, 2, 1, Some(32)).expect("invalid argon2 params");
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        // Salt should be device-specific in production; swap with a persisted
        // random salt. Left static deliberately for now ?" changing it makes
        // every existing stronghold store permanently undecryptable, so the
        // swap needs a migration story, not a drive-by fix.
        let salt = b"offroute-key-v01";
        let mut key = vec![0u8; 32];
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .expect("argon2 key derivation failed");
        key
    })
    .build()
}
*/

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
// .plugin(build_stronghold())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        // Cross-platform BLE (btleplug on desktop/iOS, native Kotlin on Android) —
        // replaces the old btleplug-only commands/bluetooth.rs.
        .plugin(tauri_plugin_blec::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::device::emit_test_event,
            commands::system_status::get_battery_status,
            commands::system_status::get_network_status,
            commands::terminal::run_system_command,
            commands::control::restart_app,
            commands::control::quit_app,
            commands::control::write_report_file,
            commands::control::browser_navigate,
            commands::control::browser_bounds,
            commands::control::browser_hide,
            commands::control::browser_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
