import { Module } from "@nestjs/common";
import { EvacuationController } from "./evacuation.controller";
import { EvacuationService } from "./evacuation.service";
import { EventsGateway } from "../gateway/events.gateway";

@Module({
  controllers: [EvacuationController],
  providers: [EvacuationService, EventsGateway],
})
export class EvacuationModule {}
