import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";
import { AssignTaskDto, UpdateTaskStatusDto, UpdatePositionDto } from "./dto/tasks.dto";

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  findAll() {
    return this.prisma.task.findMany({
      include: { hazard: true, ranger: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Pick the nearest free ranger to the hazard and create a Task.
   * Mirrors the assign() logic in src/store/tasks.ts.
   */
  async assign(dto: AssignTaskDto) {
    const { hazardId, baseLat, baseLon } = dto;

    // Guard: already being worked or resolved
    const existing = await this.prisma.task.findFirst({
      where: { hazardId, status: "enroute" },
    });
    if (existing) throw new BadRequestException("Hazard already has an active task");

    const alreadyResolved = await this.prisma.resolvedHazard.findUnique({ where: { hazardId } });
    if (alreadyResolved) throw new BadRequestException("Hazard already resolved");

    const hazard = await this.prisma.incident.findUnique({ where: { id: hazardId } });
    if (!hazard) throw new NotFoundException(`Incident ${hazardId} not found`);

    // Busy rangers = those currently enroute on another task
    const busyTasks = await this.prisma.task.findMany({ where: { status: "enroute" } });
    const busyIds = new Set(busyTasks.map((t) => t.rangerId));

    const allPersonnel = await this.prisma.personnel.findMany();
    const available = allPersonnel.filter((p) => !busyIds.has(p.id));
    if (available.length === 0) throw new BadRequestException("No rangers available");

    const targetLat = baseLat + hazard.offsetLat;
    const targetLon = baseLon + hazard.offsetLon;

    // Pick nearest by Haversine distance
    const nearest = available.reduce(
      (best, r) => {
        const rLat = baseLat + r.offsetLat;
        const rLon = baseLon + r.offsetLon;
        const d = Math.hypot(rLat - targetLat, rLon - targetLon);
        return d < best.d ? { r, d } : best;
      },
      { r: available[0], d: Infinity },
    ).r;

    const unitLat = baseLat + nearest.offsetLat;
    const unitLon = baseLon + nearest.offsetLon;

    const task = await this.prisma.task.create({
      data: { hazardId, rangerId: nearest.id, status: "enroute", unitLat, unitLon },
      include: { hazard: true, ranger: true },
    });

    this.gateway.emit("task-update", {
      hazardId: task.hazardId,
      rangerId: task.rangerId,
      status: task.status,
      unitLat: task.unitLat,
      unitLon: task.unitLon,
    });

    return task;
  }

  async updateStatus(id: string, dto: UpdateTaskStatusDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.unitLat !== undefined && { unitLat: dto.unitLat }),
        ...(dto.unitLon !== undefined && { unitLon: dto.unitLon }),
      },
      include: { hazard: true, ranger: true },
    });

    if (dto.status === "arrived") {
      // Write permanent resolution record
      await this.prisma.resolvedHazard.upsert({
        where: { hazardId: task.hazardId },
        update: {},
        create: {
          hazardId: task.hazardId,
          rangerId: updated.ranger.id,
          rangerName: updated.ranger.name,
          callsign: updated.ranger.callsign,
        },
      });
    }

    this.gateway.emit("task-update", {
      hazardId: updated.hazardId,
      rangerId: updated.rangerId,
      status: updated.status,
      unitLat: updated.unitLat,
      unitLon: updated.unitLon,
    });

    return updated;
  }

  async updatePosition(id: string, dto: UpdatePositionDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);

    await this.prisma.task.update({ where: { id }, data: { unitLat: dto.lat, unitLon: dto.lon } });

    this.gateway.emit("ranger-position", { rangerId: task.rangerId, lat: dto.lat, lon: dto.lon });
    return { ok: true };
  }
}
