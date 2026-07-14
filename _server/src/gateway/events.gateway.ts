import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

export interface PresenceEntry {
  rangerId: string;
  name: string;
  callsign: string;
  lastSeen: number;
}

/**
 * Central Socket.IO gateway — injected into feature services so they can
 * emit realtime events to all connected frontend clients.
 *
 * Events emitted (Server → Client):
 *  - task-update       { hazardId, rangerId, status, unitLat, unitLon }
 *  - ranger-position   { rangerId, lat, lon }
 *  - flare-broadcast   { flareId, sequence, status }
 *  - evac-request      EvacuationRequest payload
 *  - evac-confirmed    EvacuationPoint payload
 *  - message-pin       MessagePin payload
 *  - comms-message     CommEntry payload
 *  - incident-new      Incident payload
 *  - presence-update   PresenceEntry[] — every currently-connected personel unit
 *
 * Events received (Client → Server):
 *  - presence-heartbeat  { rangerId, name, callsign } — personel pings this
 *    periodically while its app is open; not persisted, purely in-memory,
 *    so radar can tell who's actually online vs gone silent right now.
 */
@WebSocketGateway({
  cors: {
    origin: ["http://localhost:1420", "tauri://localhost"],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Keyed by socket.id, not rangerId — a reload opens a new socket, and the
  // stale entry is cleaned up by that old socket's own disconnect event.
  private presence = new Map<string, PresenceEntry>();

  handleConnection(client: Socket) {
    console.log(`[WS] Client connected: ${client.id}`);
    client.emit("presence-update", Array.from(this.presence.values()));
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] Client disconnected: ${client.id}`);
    if (this.presence.delete(client.id)) {
      this.broadcastPresence();
    }
  }

  @SubscribeMessage("presence-heartbeat")
  handlePresenceHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { rangerId: string; name: string; callsign: string },
  ) {
    if (!body || typeof body.rangerId !== "string") return; // malformed payload, ignore rather than throw
    this.presence.set(client.id, { ...body, lastSeen: Date.now() });
    this.broadcastPresence();
  }

  private broadcastPresence() {
    this.server.emit("presence-update", Array.from(this.presence.values()));
  }

  emit<T>(event: string, payload: T) {
    this.server.emit(event, payload);
  }
}
