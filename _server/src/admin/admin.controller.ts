import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { AdminTokenGuard } from "./admin-token.guard";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("stats")
  @ApiOperation({ summary: "Row counts across every domain table" })
  stats() {
    return this.admin.stats();
  }

  // Destructive: deletes every row in every table before reseeding. Requires
  // the shared admin secret — see AdminTokenGuard for why this exists.
  @Post("reseed")
  @UseGuards(AdminTokenGuard)
  @ApiOperation({
    summary: "Wipe all data and restore the canonical seed (DESTRUCTIVE)",
    description:
      "Deletes every row in every table, then reseeds. Requires the " +
      "x-admin-token header to match the server's ADMIN_TOKEN environment " +
      "variable. Returns 503 if the server has no ADMIN_TOKEN configured.",
  })
  @ApiHeader({
    name: "x-admin-token",
    description: "Shared admin secret, must equal the server's ADMIN_TOKEN.",
    required: true,
  })
  @ApiResponse({ status: 401, description: "Invalid or missing x-admin-token." })
  @ApiResponse({ status: 503, description: "Server has no ADMIN_TOKEN configured." })
  reseed() {
    return this.admin.reseed();
  }
}
