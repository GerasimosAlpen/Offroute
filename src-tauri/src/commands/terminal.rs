use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

/// Read-only system-diagnostic binaries the terminal is allowed to run.
/// Deliberately an allowlist, not a denylist: this is a "check the system"
/// console, not a root shell. Commands are spawned directly (no shell), so
/// there's no `;`/`&&`/pipe injection — each token is a literal argv entry.
const ALLOWED: &[&str] = &[
    // identity / basics
    "uname", "whoami", "id", "hostname", "date", "uptime", "arch", "pwd", "echo", "which", "env",
    // cpu / memory / load
    "sysctl", "vm_stat", "free", "nproc", "lscpu", "top", "w", "ps",
    // disk
    "df", "du",
    // network
    "ifconfig", "ip", "ping", "netstat", "ping6", "route", "nslookup", "host",
    // platform
    "sw_vers", "lsb_release",
    // listing (read-only)
    "ls", "cat",
];

const MAX_OUTPUT: usize = 40_000;
const TIMEOUT_SECS: u64 = 10;

/// Some tools run forever without a limit — inject sane, self-terminating
/// defaults so the terminal never just hangs until the timeout kills it.
fn normalize(bin: &str, mut args: Vec<String>) -> Vec<String> {
    match bin {
        "ping" | "ping6" if !args.iter().any(|a| a == "-c") => {
            let mut out = vec!["-c".to_string(), "4".to_string()];
            out.append(&mut args);
            out
        }
        "top" if !args.iter().any(|a| a == "-l" || a == "-n" || a == "-b") => {
            // macOS: one sample; Linux batch one iteration.
            if cfg!(target_os = "macos") {
                vec!["-l".to_string(), "1".to_string()]
            } else {
                vec!["-b".to_string(), "-n".to_string(), "1".to_string()]
            }
        }
        _ => args,
    }
}

/// Runs a single, allowlisted read-only diagnostic command. Returns combined
/// stdout+stderr, or a friendly `Err` string (never panics). The frontend
/// handles built-in commands (help/clear/health/…) itself and only reaches
/// here for real system binaries.
#[tauri::command]
pub async fn run_system_command(input: String) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }

    let mut tokens = trimmed.split_whitespace();
    let bin = tokens.next().unwrap_or("").to_string();
    let args: Vec<String> = tokens.map(|s| s.to_string()).collect();

    // No paths — bare binary names only, resolved via PATH.
    if bin.contains('/') || bin.contains('\\') {
        return Err(format!("'{bin}': hanya nama perintah (tanpa path) yang diizinkan"));
    }
    if !ALLOWED.contains(&bin.as_str()) {
        return Err(format!(
            "'{bin}': perintah tidak diizinkan.\nTerminal ini hanya untuk diagnostik sistem (baca-saja).\nKetik 'help' untuk daftar perintah."
        ));
    }

    let args = normalize(&bin, args);
    let fut = Command::new(&bin).args(&args).output();

    let output = match timeout(Duration::from_secs(TIMEOUT_SECS), fut).await {
        Err(_) => return Err(format!("'{bin}': waktu habis ({TIMEOUT_SECS}s)")),
        Ok(Err(e)) => return Err(format!("'{bin}': gagal dijalankan — {e}")),
        Ok(Ok(o)) => o,
    };

    let mut combined = String::new();
    combined.push_str(&String::from_utf8_lossy(&output.stdout));
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.trim().is_empty() {
        combined.push_str(&stderr);
    }
    if combined.len() > MAX_OUTPUT {
        combined.truncate(MAX_OUTPUT);
        combined.push_str("\n… (output dipotong)");
    }
    if combined.trim().is_empty() {
        combined = format!("(tidak ada output, exit {})", output.status.code().unwrap_or(-1));
    }
    Ok(combined)
}
