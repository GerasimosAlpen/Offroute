import { Controller, Get, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { FlareService } from "./flare.service";

@ApiTags("flare")
@Controller("flare")
export class FlareController {
  constructor(private readonly flareService: FlareService) {}

  @Get("current")
  @ApiOperation({ summary: "Get most recent FLARE alert (to check if active on load)" })
  @ApiResponse({ status: 200, description: "Latest FlareAlert or null" })
  getCurrent() {
    return this.flareService.getCurrent();
  }

  @Post("activate")
  @ApiOperation({ summary: "Declare a major incident (FLARE). Broadcasts flare-broadcast WS event." })
  @ApiResponse({ status: 201, description: "FlareAlert created with incremented sequence" })
  activate() {
    return this.flareService.activate();
  }

  @Post("deactivate")
  @ApiOperation({ summary: "Stand down an active FLARE. Broadcasts flare-broadcast WS event with status calm." })
  @ApiResponse({ status: 200, description: "FlareAlert updated to calm, or unchanged if none was active" })
  deactivate() {
    return this.flareService.deactivate();
  }
}
