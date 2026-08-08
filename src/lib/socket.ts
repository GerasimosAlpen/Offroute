import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "./apiBase";
import { SOCKET_RECONNECT_DELAY_MS, SOCKET_RECONNECT_MAX_MS } from "./timings";

/**
 * Singleton Socket.IO client.
 * Import `socket` directly — it connects once, lazily, on first import.
 *
 * Usage:
 *   import { socket } from "@/lib/socket";
 *   socket.on("comms-message", (payload) => { ... });
 */
export const socket: Socket = io(getApiBaseUrl(), {
  autoConnect: true,
  // Retry forever — disaster-zone connectivity is intermittent by nature,
  // and a client that silently gives up after N attempts stays offline for
  // good even when the network comes back. (A capped attempt count here was
  // exactly that bug.)
  reconnection: true,
  reconnectionDelay: SOCKET_RECONNECT_DELAY_MS,
  reconnectionDelayMax: SOCKET_RECONNECT_MAX_MS,
  transports: ["websocket"],
});

socket.on("connect", () => console.log("[WS] Connected:", socket.id));
socket.on("disconnect", (reason) => console.log("[WS] Disconnected:", reason));
socket.on("connect_error", (err) => console.warn("[WS] Connection error:", err.message));
