import { Module } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";
import { EventsGateway } from "../gateway/events.gateway";

@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService, EventsGateway],
  exports: [IncidentsService],
})
export class IncidentsModule {}
