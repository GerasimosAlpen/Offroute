import { Module } from "@nestjs/common";
import { VictimsController } from "./victims.controller";
import { VictimsService } from "./victims.service";
import { GatewayModule } from "../gateway/gateway.module";

@Module({
  imports: [GatewayModule],
  controllers: [VictimsController],
  providers: [VictimsService],
})
export class VictimsModule {}
