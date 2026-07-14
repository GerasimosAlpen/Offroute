import { Module } from "@nestjs/common";
import { FlareController } from "./flare.controller";
import { FlareService } from "./flare.service";
import { EventsGateway } from "../gateway/events.gateway";

@Module({
  controllers: [FlareController],
  providers: [FlareService, EventsGateway],
})
export class FlareModule {}
