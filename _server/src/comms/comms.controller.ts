import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { CommsService } from "./comms.service";

@ApiTags("comms")
@Controller("comms")
export class CommsController {
  constructor(private readonly commsService: CommsService) {}

  @Get("history")
  @ApiOperation({ summary: "Get Comm Center radio log history (all entries, oldest first)" })
  @ApiResponse({ status: 200, description: "Array of CommEntry matching commsLog.ts shape. New entries arrive via comms-message WS event." })
  getHistory() {
    return this.commsService.getHistory();
  }
}
