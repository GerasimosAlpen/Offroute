import { Module } from "@nestjs/common";
import { FlareController } from "./flare.controller";
import { FlareService } from "./flare.service";
import { GatewayModule } from "../gateway/gateway.module";

@Module({
  imports: [GatewayModule],
  controllers: [FlareController],
  providers: [FlareService],
})
export class FlareModule {}
