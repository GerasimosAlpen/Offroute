import { Module } from "@nestjs/common";
import { CommsController } from "./comms.controller";
import { CommsService } from "./comms.service";
import { EventsGateway } from "../gateway/events.gateway";

@Module({
  controllers: [CommsController],
  providers: [CommsService, EventsGateway],
  exports: [CommsService],
})
export class CommsModule {}
