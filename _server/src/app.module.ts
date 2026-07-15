import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { PersonnelModule } from "./personnel/personnel.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { TasksModule } from "./tasks/tasks.module";
import { FlareModule } from "./flare/flare.module";
import { EvacuationModule } from "./evacuation/evacuation.module";
import { MessagesModule } from "./messages/messages.module";
import { CommsModule } from "./comms/comms.module";
import { VictimsModule } from "./victims/victims.module";
import { AdminModule } from "./admin/admin.module";
import { ProxyModule } from "./proxy/proxy.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PersonnelModule,
    IncidentsModule,
    TasksModule,
    FlareModule,
    EvacuationModule,
    MessagesModule,
    CommsModule,
    VictimsModule,
    AdminModule,
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
