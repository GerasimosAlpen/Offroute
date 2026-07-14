import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { PersonnelService } from "./personnel.service";

@ApiTags("personnel")
@Controller("personnel")
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  @Get()
  @ApiOperation({ summary: "List all rangers / field personel" })
  @ApiResponse({ status: 200, description: "Array of Personnel matching Ranger shape in src/lib/rangers.ts" })
  findAll() {
    return this.personnelService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one personel by ID" })
  @ApiParam({ name: "id", example: "bravo" })
  @ApiResponse({ status: 200, description: "Personnel record" })
  @ApiResponse({ status: 404, description: "Not found" })
  async findOne(@Param("id") id: string) {
    const p = await this.personnelService.findOne(id);
    if (!p) throw new NotFoundException(`Personnel ${id} not found`);
    return p;
  }
}
