use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const DEVICE_STATUS_EVENT: &str = "device://status";

#[derive(Clone, Serialize)]
pub struct DeviceStatusPayload {
    pub status: String,
    pub ts: i64,
}

/// Stub emitter for the generic realtime event channel. Fires one
/// `device://status` event so the frontend `useTauriEvent` hook has
/// something to prove the pipe works end to end. Swap the payload source
/// for real hardware/device polling (or a background Tokio task) once the
/// ranger data model is scoped.
#[tauri::command]
pub fn emit_test_event(app: AppHandle) -> Result<(), String> {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    app.emit(DEVICE_STATUS_EVENT, DeviceStatusPayload { status: "ok".into(), ts })
        .map_err(|e| e.to_string())
}
