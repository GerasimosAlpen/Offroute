import { Module } from "@nestjs/common";
import { EventsGateway } from "./events.gateway";

/**
 * Single shared instance of EventsGateway — feature modules import this
 * instead of listing EventsGateway in their own `providers`, so there's one
 * gateway (and one handleConnection/handleDisconnect firing per client),
 * not six separate Nest-instantiated copies of the same class.
 */
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
