import { Controller, Get, Post, Patch, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from "@nestjs/swagger";
import { TasksService } from "./tasks.service";
import { AssignTaskDto, SelfAssignTaskDto, UpdateTaskStatusDto, UpdatePositionDto } from "./dto/tasks.dto";

@ApiTags("tasks")
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: "List all live tasks (enroute + arrived-awaiting-confirmation)" })
  findAll() {
    return this.tasksService.findAll();
  }

  @Get("resolved")
  @ApiOperation({ summary: "List confirmed resolutions (radar-confirmed completions)" })
  findResolved() {
    return this.tasksService.findResolved();
  }

  @Post("assign")
  @ApiOperation({ summary: "Radar assigns nearest free ranger to a hazard" })
  @ApiBody({ type: AssignTaskDto })
  @ApiResponse({ status: 201, description: "Task created + task-update WS event emitted" })
  @ApiResponse({ status: 400, description: "Hazard already active or no rangers available" })
  assign(@Body() dto: AssignTaskDto) {
    return this.tasksService.assign(dto);
  }

  @Post("self-assign")
  @ApiOperation({ summary: "Personel takes a hazard on their own initiative (validated against double-dispatch)" })
  @ApiBody({ type: SelfAssignTaskDto })
  @ApiResponse({ status: 201, description: "Task created + task-update WS event emitted" })
  @ApiResponse({ status: 400, description: "Hazard already has an active unit, or this unit is busy" })
  selfAssign(@Body() dto: SelfAssignTaskDto) {
    return this.tasksService.selfAssign(dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Personel reports task complete (enroute → arrived = awaiting radar confirmation)" })
  @ApiParam({ name: "id", description: "Task ID" })
  @ApiBody({ type: UpdateTaskStatusDto })
  @ApiResponse({ status: 200, description: "Updated task + task-update WS event (no ResolvedHazard until radar confirms)" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateTaskStatusDto) {
    return this.tasksService.updateStatus(id, dto);
  }

  @Post(":id/confirm")
  @ApiOperation({ summary: "Radar confirms a completion report — writes ResolvedHazard, clears the live task" })
  @ApiParam({ name: "id", description: "Task ID" })
  @ApiResponse({ status: 201, description: "ResolvedHazard written + task-confirmed WS event" })
  @ApiResponse({ status: 400, description: "Task is not in the awaiting-confirmation (arrived) state" })
  confirm(@Param("id") id: string) {
    return this.tasksService.confirm(id);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Radar rejects a completion report — unit goes back to enroute, hazard stays active" })
  @ApiParam({ name: "id", description: "Task ID" })
  @ApiResponse({ status: 201, description: "Task back to enroute + task-rejected WS event" })
  rejectCompletion(@Param("id") id: string) {
    return this.tasksService.reject(id);
  }

  @Post(":id/position")
  @ApiOperation({ summary: "Update live ranger position (called during animation)" })
  @ApiParam({ name: "id", description: "Task ID" })
  @ApiBody({ type: UpdatePositionDto })
  @ApiResponse({ status: 200, description: "Position updated + ranger-position WS event emitted" })
  updatePosition(@Param("id") id: string, @Body() dto: UpdatePositionDto) {
    return this.tasksService.updatePosition(id, dto);
  }
}
