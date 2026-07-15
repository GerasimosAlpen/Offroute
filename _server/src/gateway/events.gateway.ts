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
import { CORS_ORIGINS } from "../cors";

export interface PresenceEntry {
  rangerId: string;
  name: string;
  callsign: string;
  lastSeen: number;
  dutyStatus: "on_duty" | "idle";
  /** Live GPS position, when the unit's device shared one with its heartbeat. */
  lat?: number;
  lon?: number;
}

/**
 * Central Socket.IO gateway — injected into feature services so they can
 * emit realtime events to all connected frontend clients.
 *
 * Events emitted (Server → Client):
 *  - task-update       { hazardId, rangerId, status, unitLat, unitLon, rangerName?, callsign?, selfAssigned? }
 *  - task-confirmed    { hazardId, rangerId, rangerName, callsign } — radar confirmed a completion report
 *  - task-rejected     { hazardId, rangerId, rangerName, callsign } — radar sent the unit back to keep working
 *  - ranger-position   { rangerId, lat, lon }
 *  - flare-broadcast   { flareId, sequence, status }
 *  - evac-request      EvacuationRequest payload
 *  - evac-request-decided { id, accepted } — radar accepted/rejected a pending request
 *  - evac-confirmed    EvacuationPoint payload
 *  - evac-removed      { id } — radar removed a confirmed evacuation point
 *  - message-pin       MessagePin payload
 *  - comms-message     CommEntry payload
 *  - incident-new      Incident payload
 *  - presence-update   PresenceEntry[] — every currently-connected personel unit
 *  - victim-sos        Victim payload — new or updated SOS ping from /sos
 *  - victim-rescued    { id } — radar marked a victim as found
 *
 * Events received (Client → Server):
 *  - presence-heartbeat  { rangerId, name, callsign, dutyStatus?, lat?, lon? }
 *    — personel pings this periodically (and on GPS movement) while its app
 *    is open; not persisted, purely in-memory, so radar can tell who's
 *    actually online vs gone silent right now, and where each live unit
 *    physically is.
 */
@WebSocketGateway({
  cors: {
    origin: CORS_ORIGINS,
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
    @MessageBody()
    body: {
      rangerId: string;
      name: string;
      callsign: string;
      dutyStatus?: "on_duty" | "idle";
      lat?: number;
      lon?: number;
    },
  ) {
    if (!body || typeof body.rangerId !== "string") return; // malformed payload, ignore rather than throw
    // Coordinates only pass through as a validated pair — a heartbeat with
    // junk position data degrades to a plain presence ping, never NaN on maps.
    const hasPos =
      typeof body.lat === "number" && Number.isFinite(body.lat) && Math.abs(body.lat) <= 90 &&
      typeof body.lon === "number" && Number.isFinite(body.lon) && Math.abs(body.lon) <= 180;
    this.presence.set(client.id, {
      rangerId: body.rangerId,
      name: body.name,
      callsign: body.callsign,
      dutyStatus: body.dutyStatus ?? "on_duty",
      lastSeen: Date.now(),
      ...(hasPos ? { lat: body.lat, lon: body.lon } : {}),
    });
    this.broadcastPresence();
  }

  private broadcastPresence() {
    this.server.emit("presence-update", Array.from(this.presence.values()));
  }

  emit<T>(event: string, payload: T) {
    this.server.emit(event, payload);
  }
}
