import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { GatewayModule } from "../gateway/gateway.module";

@Module({
  imports: [GatewayModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
