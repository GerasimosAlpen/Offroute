import { Controller, Get, Post } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("stats")
  @ApiOperation({ summary: "Row counts across every domain table" })
  stats() {
    return this.admin.stats();
  }

  @Post("reseed")
  @ApiOperation({ summary: "Wipe all data and restore the canonical seed (destructive)" })
  reseed() {
    return this.admin.reseed();
  }
}
