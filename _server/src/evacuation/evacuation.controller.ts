import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from "@nestjs/swagger";
import { EvacuationService } from "./evacuation.service";
import { CreateEvacRequestDto } from "./dto/evacuation.dto";

@ApiTags("evacuation")
@Controller("evacuation")
export class EvacuationController {
  constructor(private readonly evacuationService: EvacuationService) {}

  @Get("points")
  @ApiOperation({ summary: "List all confirmed evacuation points" })
  @ApiResponse({ status: 200, description: "Array of EvacuationPoint matching evacuationPoints.ts shape" })
  getPoints() {
    return this.evacuationService.getPoints();
  }

  @Get("pending")
  @ApiOperation({ summary: "List pending evacuation requests (awaiting radar decision)" })
  getpending() {
    return this.evacuationService.getPending();
  }

  @Post("request")
  @ApiOperation({ summary: "Personel offers their position as safe evacuation point. Emits evac-request WS event." })
  @ApiBody({ type: CreateEvacRequestDto })
  @ApiResponse({ status: 201, description: "EvacuationRequest created" })
  createRequest(@Body() dto: CreateEvacRequestDto) {
    return this.evacuationService.createRequest(dto);
  }

  @Post("accept/:id")
  @ApiOperation({ summary: "Radar accepts evacuation request — creates point + emits evac-confirmed WS event" })
  @ApiParam({ name: "id", description: "EvacuationRequest ID" })
  @ApiResponse({ status: 201, description: "EvacuationPoint created" })
  accept(@Param("id") id: string) {
    return this.evacuationService.accept(id);
  }

  @Post("reject/:id")
  @ApiOperation({ summary: "Radar rejects evacuation request" })
  @ApiParam({ name: "id", description: "EvacuationRequest ID" })
  reject(@Param("id") id: string) {
    return this.evacuationService.reject(id);
  }
}
