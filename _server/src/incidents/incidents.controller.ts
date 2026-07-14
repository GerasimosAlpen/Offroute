import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { IncidentsService } from "./incidents.service";
import { CreateIncidentDto } from "./dto/create-incident.dto";

@ApiTags("incidents")
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: "List all active incidents / hazards" })
  @ApiResponse({ status: 200, description: "Array of Incident matching HazardData shape in src/lib/hazards.ts" })
  findAll() {
    return this.incidentsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: "Report a new incident (Lapor Incident)" })
  @ApiBody({ type: CreateIncidentDto })
  @ApiResponse({ status: 201, description: "Created incident, also broadcasts incident-new WS event" })
  create(@Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(dto);
  }
}
