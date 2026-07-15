use std::collections::HashMap;

use btleplug::api::{Central, Manager as _, Peripheral as _, ScanFilter, WriteType};
use btleplug::platform::{Adapter, Manager, Peripheral};
use futures::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use uuid::Uuid;

// Nordic UART Service (NUS) — a de facto standard BLE serial/text-relay
// protocol, used here instead of a custom UUID scheme so this can be
// verified against any existing NUS-compatible peripheral (e.g. a phone
// running nRF Connect in peripheral mode), not just another Offroute
// instance. Offroute doesn't have a peripheral/GATT-server role of its own
// yet — see TODO.md's "Bluetooth — two tiers" section — so this Tier 1
// module is BLE central/client only: it can scan, connect to, and talk to
// existing peripherals, but two copies of Offroute can't yet talk directly
// to each other over Bluetooth.
const NUS_RX_CHAR_UUID: Uuid = Uuid::from_u128(0x6e400002_b5a3_f393_e0a9_e50e24dcca9e); // write to peripheral
const NUS_TX_CHAR_UUID: Uuid = Uuid::from_u128(0x6e400003_b5a3_f393_e0a9_e50e24dcca9e); // notifications from peripheral

pub const BLE_MESSAGE_EVENT: &str = "ble://message-received";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BleDevice {
    pub id: String,
    pub name: Option<String>,
    pub rssi: Option<i16>,
    pub connected: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BleMessage {
    pub device_id: String,
    pub text: String,
}

#[derive(Default)]
struct BleStateInner {
    adapter: Option<Adapter>,
    /// Peripherals seen since the last scan — keyed by btleplug's own id
    /// string, so the frontend can refer to a device without needing to
    /// understand platform-specific address formats.
    peripherals: HashMap<String, Peripheral>,
    /// Live notification-forwarding tasks, keyed by device id — retained so
    /// a disconnect (or reconnect) can abort the old task instead of leaking
    /// it, which would double-deliver every inbound message.
    notify_tasks: HashMap<String, tauri::async_runtime::JoinHandle<()>>,
}

#[derive(Default)]
pub struct BleState {
    inner: Mutex<BleStateInner>,
}

/// Returns the (cached) adapter WITHOUT holding the state lock across any
/// BLE await — all six commands share one Mutex, so a guard held through
/// slow radio round-trips would stall every other command behind it.
async fn get_adapter(state: &BleState) -> Result<Adapter, String> {
    {
        let inner = state.inner.lock().await;
        if let Some(adapter) = &inner.adapter {
            return Ok(adapter.clone());
        }
    }
    let manager = Manager::new().await.map_err(|e| e.to_string())?;
    let adapters = manager.adapters().await.map_err(|e| e.to_string())?;
    let adapter = adapters
        .into_iter()
        .next()
        .ok_or_else(|| "no Bluetooth adapter found on this machine".to_string())?;
    state.inner.lock().await.adapter = Some(adapter.clone());
    Ok(adapter)
}

#[tauri::command]
pub async fn ble_start_scan(state: State<'_, BleState>) -> Result<(), String> {
    let adapter = get_adapter(&state).await?;
    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ble_stop_scan(state: State<'_, BleState>) -> Result<(), String> {
    let adapter = get_adapter(&state).await?;
    adapter.stop_scan().await.map_err(|e| e.to_string())
}

/// Lists whatever the adapter has seen so far — call after `ble_start_scan`
/// and a short wait, not instead of it (this doesn't itself scan).
#[tauri::command]
pub async fn ble_list_devices(state: State<'_, BleState>) -> Result<Vec<BleDevice>, String> {
    let adapter = get_adapter(&state).await?;
    let peripherals = adapter.peripherals().await.map_err(|e| e.to_string())?;

    // Enumerate without the lock — this loop is multiple BLE round-trips and
    // the frontend polls it every 1.5s while scanning.
    let mut devices = Vec::with_capacity(peripherals.len());
    let mut seen = Vec::with_capacity(peripherals.len());
    for p in peripherals {
        let id = p.id().to_string();
        let props = p.properties().await.map_err(|e| e.to_string())?;
        let connected = p.is_connected().await.unwrap_or_else(|e| {
            eprintln!("[ble] is_connected failed for {id}: {e}");
            false
        });

        devices.push(BleDevice {
            id: id.clone(),
            name: props.as_ref().and_then(|pr| pr.local_name.clone()),
            rssi: props.as_ref().and_then(|pr| pr.rssi),
            connected,
        });
        seen.push((id, p));
    }

    let mut inner = state.inner.lock().await;
    for (id, p) in seen {
        inner.peripherals.insert(id, p);
    }
    Ok(devices)
}

#[tauri::command]
pub async fn ble_connect(app: AppHandle, state: State<'_, BleState>, device_id: String) -> Result<(), String> {
    let peripheral = {
        let inner = state.inner.lock().await;
        inner
            .peripherals
            .get(&device_id)
            .cloned()
            .ok_or_else(|| "device not found — call ble_list_devices after scanning first".to_string())?
    };

    // Re-connecting an already-connected device would subscribe a second
    // time and spawn a second forwarding task — every inbound message would
    // then be emitted twice.
    if peripheral.is_connected().await.unwrap_or(false) {
        return Ok(());
    }

    peripheral.connect().await.map_err(|e| e.to_string())?;
    peripheral.discover_services().await.map_err(|e| e.to_string())?;

    let tx_char = peripheral
        .characteristics()
        .into_iter()
        .find(|c| c.uuid == NUS_TX_CHAR_UUID);

    if let Some(tx_char) = tx_char {
        peripheral.subscribe(&tx_char).await.map_err(|e| e.to_string())?;

        let mut notifications = peripheral.notifications().await.map_err(|e| e.to_string())?;
        let app_handle = app.clone();
        let device_id_for_task = device_id.clone();
        // Usually ends on its own once the peripheral disconnects and the
        // stream closes — but a device dropping out of range doesn't always
        // close the stream, so the handle is retained and aborted on
        // ble_disconnect / reconnect rather than trusted to finish.
        let task = tauri::async_runtime::spawn(async move {
            while let Some(notification) = notifications.next().await {
                let text = String::from_utf8_lossy(&notification.value).to_string();
                let _ = app_handle.emit(
                    BLE_MESSAGE_EVENT,
                    BleMessage { device_id: device_id_for_task.clone(), text },
                );
            }
        });

        let mut inner = state.inner.lock().await;
        if let Some(stale) = inner.notify_tasks.insert(device_id.clone(), task) {
            stale.abort();
        }
    }
    // No NUS TX characteristic found is not an error here — the peripheral
    // might be receive-only from Offroute's perspective (ble_send_message
    // still works via the RX characteristic regardless).

    Ok(())
}

#[tauri::command]
pub async fn ble_disconnect(state: State<'_, BleState>, device_id: String) -> Result<(), String> {
    let peripheral = {
        let mut inner = state.inner.lock().await;
        // Stop forwarding notifications for this device regardless of how
        // the disconnect itself goes — the stream may never close on its own.
        if let Some(task) = inner.notify_tasks.remove(&device_id) {
            task.abort();
        }
        inner
            .peripherals
            .get(&device_id)
            .cloned()
            .ok_or_else(|| "device not found".to_string())?
    };
    peripheral.disconnect().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ble_send_message(state: State<'_, BleState>, device_id: String, text: String) -> Result<(), String> {
    let peripheral = {
        let inner = state.inner.lock().await;
        inner
            .peripherals
            .get(&device_id)
            .cloned()
            .ok_or_else(|| "device not found — connect first".to_string())?
    };

    let rx_char = peripheral
        .characteristics()
        .into_iter()
        .find(|c| c.uuid == NUS_RX_CHAR_UUID)
        .ok_or_else(|| "peripheral has no NUS RX characteristic — not NUS-compatible".to_string())?;

    peripheral
        .write(&rx_char, text.as_bytes(), WriteType::WithoutResponse)
        .await
        .map_err(|e| e.to_string())
}
