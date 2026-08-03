use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryStatus {
    pub percent: u8,
    pub charging: bool,
    /// false on desktops with no battery (e.g. a plugged-in tower) — not an error.
    pub available: bool,
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn get_battery_status() -> Result<BatteryStatus, String> {
    let manager = starship_battery::Manager::new().map_err(|e| e.to_string())?;
    let mut batteries = manager.batteries().map_err(|e| e.to_string())?;

    match batteries.next() {
        Some(Ok(battery)) => {
            let percent = (battery.state_of_charge().value * 100.0).round().clamp(0.0, 100.0) as u8;
            let charging = matches!(
                battery.state(),
                starship_battery::State::Charging | starship_battery::State::Full
            );
            Ok(BatteryStatus { percent, charging, available: true })
        }
        _ => Ok(BatteryStatus { percent: 0, charging: false, available: false }),
    }
}

#[cfg(target_os = "android")]
#[tauri::command]
pub fn get_battery_status() -> Result<BatteryStatus, String> {
    Ok(BatteryStatus { percent: 100, charging: true, available: false })
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatus {
    pub connected: bool,
    pub ssid: Option<String>,
    pub rssi_dbm: Option<i32>,
    /// 0-100, derived from RSSI — `None` when signal strength can't be read on this platform.
    pub quality_percent: Option<u8>,
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn get_network_status() -> Result<NetworkStatus, String> {
    use std::process::Command;

    let output = Command::new("system_profiler")
        .args(["SPAirPortDataType", "-json"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "system_profiler exited with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;

    let iface = &json["SPAirPortDataType"][0]["spairport_airport_interfaces"][0];
    let connected = iface["spairport_status_information"].as_str() == Some("spairport_status_connected");

    let current = &iface["spairport_current_network_information"];
    let ssid = current["_name"].as_str().map(String::from);

    let rssi_dbm = current["spairport_signal_noise"]
        .as_str()
        .and_then(|s| s.split(" dBm").next())
        .and_then(|s| s.trim().parse::<i32>().ok());

    let quality_percent = rssi_dbm.map(|rssi| (2 * (rssi + 100)).clamp(0, 100) as u8);

    Ok(NetworkStatus { connected, ssid, rssi_dbm, quality_percent })
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_network_status() -> Result<NetworkStatus, String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let output = Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    let text = String::from_utf8_lossy(&output.stdout);

    let mut ssid = None;
    let mut connected = false;
    let mut quality_percent = None;

    for line in text.lines() {
        let Some((key, value)) = line.split_once(':') else { continue };
        let key = key.trim();
        let value = value.trim();

        match key {
            "SSID" => ssid = Some(value.to_string()),
            "State" => connected = value.eq_ignore_ascii_case("connected"),
            "Signal" => {
                quality_percent = value
                    .trim_end_matches('%')
                    .trim()
                    .parse::<u8>()
                    .ok()
                    .map(|p| p.clamp(0, 100));
            }
            _ => {}
        }
    }

    // netsh reports quality directly, not raw RSSI — no dBm figure to surface here.
    Ok(NetworkStatus { connected, ssid, rssi_dbm: None, quality_percent })
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn get_network_status() -> Result<NetworkStatus, String> {
    // Kernel-exposed, no external binary required (nmcli/iw aren't guaranteed present).
    // Format (see `man 5 proc`, /proc/net/wireless): header x2, then per-interface:
    //   face   status   link   level   noise   ...
    //   wlan0: 0000     70.    -40.    -256    ...
    // `link` is a driver-defined quality figure, conventionally out of 70.
    let contents = std::fs::read_to_string("/proc/net/wireless")
        .map_err(|e| e.to_string())?;

    let data_line = contents
        .lines()
        .skip(2)
        .find(|l| !l.trim().is_empty())
        .ok_or("no wireless interface found")?;

    let fields: Vec<&str> = data_line.split_whitespace().collect();
    if fields.len() < 4 {
        return Err("unexpected /proc/net/wireless format".into());
    }

    let link_quality: f32 = fields[2].trim_end_matches('.').parse().map_err(|_| "bad link quality")?;
    let level_dbm: f32 = fields[3].trim_end_matches('.').parse().map_err(|_| "bad signal level")?;

    let quality_percent = ((link_quality / 70.0) * 100.0).round().clamp(0.0, 100.0) as u8;

    Ok(NetworkStatus {
        connected: true,
        ssid: None, // not exposed by this file; would need NetworkManager/D-Bus for the name
        rssi_dbm: Some(level_dbm as i32),
        quality_percent: Some(quality_percent),
    })
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
#[tauri::command]
pub fn get_network_status() -> Result<NetworkStatus, String> {
    Err("WiFi signal strength isn't implemented on this platform".into())
}
