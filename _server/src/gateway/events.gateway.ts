import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

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

  handleConnection(client: Socket) {
    console.log(`[WS] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] Client disconnected: ${client.id}`);
  }

  emit<T>(event: string, payload: T) {
    this.server.emit(event, payload);
  }
}
