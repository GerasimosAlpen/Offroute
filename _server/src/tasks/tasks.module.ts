import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { EventsGateway } from "../gateway/events.gateway";

@Module({
  controllers: [TasksController],
  providers: [TasksService, EventsGateway],
  exports: [TasksService],
})
export class TasksModule {}
