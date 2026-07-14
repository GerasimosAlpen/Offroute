import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { EventsGateway } from "../gateway/events.gateway";

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, EventsGateway],
})
export class MessagesModule {}
