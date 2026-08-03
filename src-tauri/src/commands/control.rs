use std::fs;
use std::path::PathBuf;
use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Url, WebviewUrl};

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
// Parked far off-screen to "hide" the embedded webview without destroying it.
const OFFSCREEN: f64 = -20000.0;

/// A REAL browser engine embedded as a child webview *inside* the main radar
/// window — not a second OS window. Google, YouTube and other JS-heavy /
/// anti-framing sites that an iframe proxy can never render all work here.
/// The frontend keeps it positioned over the Browser panel via `browser_bounds`.
/// The loaded remote page gets no Tauri IPC — it's just a browser view.
#[tauri::command]
pub async fn browser_navigate(app: AppHandle, url: String) -> Result<(), String> {
    #[cfg(mobile)]
    return Err("Embedded browser is only supported on desktop".to_string());

    #[cfg(desktop)]
    {
        let parsed: Url = url.parse().map_err(|_| "URL tidak valid".to_string())?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Err("Hanya http/https yang diizinkan".to_string());
        }

        if let Some(wv) = app.get_webview(BROWSER_LABEL) {
            wv.navigate(parsed).map_err(|e| e.to_string())?;
            return Ok(());
        }

        let win = app
            .get_window("main")
            .ok_or_else(|| "jendela utama tidak ditemukan".to_string())?;
        win.add_child(
            WebviewBuilder::new(BROWSER_LABEL, WebviewUrl::External(parsed)),
            LogicalPosition::new(OFFSCREEN, OFFSCREEN),
            LogicalSize::new(800.0, 600.0),
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// Position + size the embedded browser over the Browser panel (logical px).
#[tauri::command]
pub fn browser_bounds(app: AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(wv) = app.get_webview(BROWSER_LABEL) {
            wv.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
            wv.set_size(LogicalSize::new(width.max(1.0), height.max(1.0)))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Park the embedded browser off-screen (when its panel is covered/minimized).
#[tauri::command]
pub fn browser_hide(app: AppHandle) {
    #[cfg(desktop)]
    {
        if let Some(wv) = app.get_webview(BROWSER_LABEL) {
            let _ = wv.set_position(LogicalPosition::new(OFFSCREEN, OFFSCREEN));
        }
    }
}

/// Destroy the embedded browser (leaving the tactical map page).
#[tauri::command]
pub fn browser_close(app: AppHandle) {
    #[cfg(desktop)]
    {
        if let Some(wv) = app.get_webview(BROWSER_LABEL) {
            let _ = wv.close();
        }
    }
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
