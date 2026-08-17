import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "./apiBase";

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
  reconnectionDelay: 2000,
  reconnectionDelayMax: 30_000,
  transports: ["websocket"],
});

// Connect/disconnect are routine in the field — the socket retries forever by
// design, because intermittent links are the normal case during a disaster, not
// an error. Log them only in development so a packaged build's console stays
// readable; genuine failures still warn in every build.
if (import.meta.env.DEV) {
  socket.on("connect", () => console.log("[WS] Connected:", socket.id));
  socket.on("disconnect", (reason) => console.log("[WS] Disconnected:", reason));
}
socket.on("connect_error", (err) => console.warn("[WS] Connection error:", err.message));
