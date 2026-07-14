import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiParam } from "@nestjs/swagger";
import { VictimsService } from "./victims.service";
import { SosPingDto, RangerRefDto } from "./dto/victim.dto";

@ApiTags("victims")
@Controller("victims")
export class VictimsController {
  constructor(private readonly victimsService: VictimsService) {}

  @Post("sos")
  @ApiOperation({ summary: "No-install SOS ping from a victim/bystander's own phone (see /sos page). Upserts by client-generated id, broadcasts victim-sos." })
  @ApiBody({ type: SosPingDto })
  ping(@Body() dto: SosPingDto) {
    return this.victimsService.ping(dto);
  }

  @Get("active")
  @ApiOperation({ summary: "List unresolved victim SOS pings (active, including those with a pending unconfirmed field report)" })
  active() {
    return this.victimsService.active();
  }

  @Post(":id/assign")
  @ApiOperation({ summary: "Radar dispatches a specific unit toward the victim's location. Broadcasts victim-sos." })
  @ApiParam({ name: "id" })
  @ApiBody({ type: RangerRefDto })
  assign(@Param("id") id: string, @Body() dto: RangerRefDto) {
    return this.victimsService.assignRanger(id, dto);
  }

  @Post(":id/report")
  @ApiOperation({ summary: "Personel reports the victim found/secured — awaiting radar confirmation, not yet rescued. Broadcasts victim-sos." })
  @ApiParam({ name: "id" })
  @ApiBody({ type: RangerRefDto })
  report(@Param("id") id: string, @Body() dto: RangerRefDto) {
    return this.victimsService.report(id, dto);
  }

  @Post(":id/reject-report")
  @ApiOperation({ summary: "Radar rejects the field report — victim goes back to plain active. Broadcasts victim-sos." })
  @ApiParam({ name: "id" })
  rejectReport(@Param("id") id: string) {
    return this.victimsService.rejectReport(id);
  }

  @Post(":id/confirm")
  @ApiOperation({ summary: "Radar confirms the field report — victim marked rescued. Broadcasts victim-rescued." })
  @ApiParam({ name: "id" })
  confirm(@Param("id") id: string) {
    return this.victimsService.confirmRescue(id);
  }
}
