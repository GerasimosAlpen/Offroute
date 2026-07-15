import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma/prisma.service";

@ApiTags("health")
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Liveness + DB reachability, for radar's System Monitor. Cheap — a single
   * count — so it can be polled without load. `db: false` means the API is up
   * but its database isn't, which the monitor surfaces distinctly.
   */
  @Get("health")
  @ApiOperation({ summary: "Liveness + database reachability" })
  async health() {
    let db = false;
    try {
      await this.prisma.personnel.count();
      db = true;
    } catch {
      db = false;
    }
    return { ok: true, db, ts: Date.now() };
  }
}
