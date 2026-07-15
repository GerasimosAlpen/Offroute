use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

/// Restart the Offroute app itself. This is deliberately an *app* restart,
/// not an OS reboot: rebooting the operator's machine mid-operation would be
/// destructive and needs elevated privileges, so the "reboot" control is
/// scoped to relaunching this process. Never returns (the app relaunches).
#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}

/// Quit the Offroute app.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

const BROWSER_LABEL: &str = "radar-browser";

/// Open (or navigate) a REAL in-app browser window — a full webview engine,
/// so Google, YouTube and other JS-heavy/anti-framing sites that an iframe
/// proxy can never render all work. It's Offroute's own window (not the
/// system browser) and reuses a single "radar-browser" window. The loaded
/// remote page gets no Tauri IPC, so it's just a browser tab.
#[tauri::command]
pub async fn open_browser_window(app: AppHandle, url: String) -> Result<(), String> {
    let parsed: Url = url.parse().map_err(|_| "URL tidak valid".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Hanya http/https yang diizinkan".to_string());
    }

    if let Some(win) = app.get_webview_window(BROWSER_LABEL) {
        win.navigate(parsed).map_err(|e| e.to_string())?;
        let _ = win.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, BROWSER_LABEL, WebviewUrl::External(parsed))
        .title("Radar Browser")
        .inner_size(1100.0, 780.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Best-effort human "Downloads" location, falling back to the OS-provided
/// app data dir so a report always lands *somewhere* writable.
fn report_dir(app: &AppHandle) -> PathBuf {
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).ok();
    if let Some(h) = home {
        let downloads = PathBuf::from(&h).join("Downloads");
        if downloads.is_dir() {
            return downloads;
        }
        return PathBuf::from(h);
    }
    app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir())
}

/// Write a diagnostics/report file to disk and return its full path, so the
/// operator can hand a system report off (email, ticket, etc.). Filename is
/// sanitized to a bare name — no path traversal.
#[tauri::command]
pub fn write_report_file(app: AppHandle, name: String, content: String) -> Result<String, String> {
    let safe: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();
    let safe = if safe.is_empty() { "offroute-report.txt".to_string() } else { safe };

    let dir = report_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&safe);
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
