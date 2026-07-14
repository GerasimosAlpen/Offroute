import { Controller, Get, Post, Patch, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from "@nestjs/swagger";
import { TasksService } from "./tasks.service";
import { AssignTaskDto, UpdateTaskStatusDto, UpdatePositionDto } from "./dto/tasks.dto";

@ApiTags("tasks")
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: "List all tasks (enroute + arrived)" })
  findAll() {
    return this.tasksService.findAll();
  }

  @Post("assign")
  @ApiOperation({ summary: "Assign nearest free ranger to a hazard" })
  @ApiBody({ type: AssignTaskDto })
  @ApiResponse({ status: 201, description: "Task created + task-update WS event emitted" })
  @ApiResponse({ status: 400, description: "Hazard already active or no rangers available" })
  assign(@Body() dto: AssignTaskDto) {
    return this.tasksService.assign(dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update task status (enroute → arrived)" })
  @ApiParam({ name: "id", description: "Task ID" })
  @ApiBody({ type: UpdateTaskStatusDto })
  @ApiResponse({ status: 200, description: "Updated task + task-update WS event + ResolvedHazard record on arrived" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateTaskStatusDto) {
    return this.tasksService.updateStatus(id, dto);
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
