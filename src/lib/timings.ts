/**
 * Shared timing/polling constants. One home for the interval and timeout
 * values that used to live scattered across stores, hooks, and pages, so a
 * heartbeat rate or poll cadence is tuned in exactly one place.
 */

/** BMKG earthquake feed poll cadence. */
export const BMKG_POLL_MS = 120_000;

/** Bluetooth mesh device-list refresh while scanning. */
export const BLUETOOTH_SCAN_POLL_MS = 1_500;

/** System-status polling (desktop only). */
export const BATTERY_POLL_MS = 30_000;
export const NETWORK_POLL_MS = 15_000;

/** Personel presence heartbeats to the backend. */
export const PRESENCE_HEARTBEAT_MS = 20_000;
/** Minimum gap between consecutive position pings on the same heartbeat. */
export const PRESENCE_POSITION_PING_MIN_MS = 3_000;

/** A unit is flagged "silent" after this many missed heartbeats. */
export const PERSONNEL_SILENT_THRESHOLD_MS = PRESENCE_HEARTBEAT_MS * 4.5;

/** SOS store retry cadence while the report fails to reach the backend. */
export const SOS_RETRY_MS = 10_000;
/** SOS page auto-rebeacon cadence (re-sends the SOS ping). */
export const SOS_REBEACON_MS = 15_000;

/** A flare auto-deactivates after this long if nobody stands it down. */
export const FLARE_AUTO_EXPIRY_MS = 2 * 60 * 1000;

/** Task position stream throttle (position updates per interval). */
export const TASK_POSITION_STREAM_MS = 400;

/** Incidents query staleness + auto-refresh cadence. */
export const INCIDENTS_REFRESH_MS = 30_000;

/** System Monitor health poll cadence. */
export const HEALTH_POLL_MS = 5_000;

/** Wait before falling back to IP geolocation when GPS yields nothing. */
export const IP_FALLBACK_DELAY_MS = 6_000;

/** Axios request timeouts. */
export const API_TIMEOUT_MS = 10_000;
export const HEALTH_TIMEOUT_MS = 5_000;

/** Socket.IO reconnection backoff. */
export const SOCKET_RECONNECT_DELAY_MS = 2_000;
export const SOCKET_RECONNECT_MAX_MS = 30_000;
