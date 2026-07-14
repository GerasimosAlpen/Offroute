import { Module } from "@nestjs/common";
import { CommsController } from "./comms.controller";
import { CommsService } from "./comms.service";
import { GatewayModule } from "../gateway/gateway.module";

@Module({
  imports: [GatewayModule],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService],
})
export class CommsModule {}
