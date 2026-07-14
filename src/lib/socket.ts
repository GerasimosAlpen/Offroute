import { io, type Socket } from "socket.io-client";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

/**
 * Singleton Socket.IO client.
 * Import `socket` directly — it connects once, lazily, on first import.
 *
 * Usage:
 *   import { socket } from "@/lib/socket";
 *   socket.on("comms-message", (payload) => { ... });
 */
export const socket: Socket = io(API_URL, {
  autoConnect: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  transports: ["websocket"],
});

socket.on("connect", () => console.log("[WS] Connected:", socket.id));
socket.on("disconnect", (reason) => console.log("[WS] Disconnected:", reason));
socket.on("connect_error", (err) => console.warn("[WS] Connection error:", err.message));
