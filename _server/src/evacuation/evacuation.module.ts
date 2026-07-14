import { Module } from "@nestjs/common";
import { EvacuationController } from "./evacuation.controller";
import { EvacuationService } from "./evacuation.service";
import { GatewayModule } from "../gateway/gateway.module";

@Module({
  imports: [GatewayModule],
  controllers: [EvacuationController],
  providers: [EvacuationService],
})
export class EvacuationModule {}
