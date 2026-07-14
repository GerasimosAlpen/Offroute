import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { CommsService } from "./comms.service";
import { CreateCommsEntryDto } from "./dto/create-comms-entry.dto";

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

  @Post()
  @ApiOperation({ summary: "Append a Comm Center log entry. Persists + broadcasts comms-message WS event." })
  @ApiBody({ type: CreateCommsEntryDto })
  @ApiResponse({ status: 201, description: "Created CommsEntry" })
  create(@Body() dto: CreateCommsEntryDto) {
    return this.commsService.append(dto);
  }
}
