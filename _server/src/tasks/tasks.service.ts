import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService, type PrismaTx } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";
import { AssignTaskDto, SelfAssignTaskDto, UpdateTaskStatusDto, UpdatePositionDto } from "./dto/tasks.dto";

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

  /** Confirmed resolutions — the permanent "hazard X handled by ranger Y" record, for hydrating radar on load. Separate from live tasks now that `arrived` means "reported, awaiting confirmation", not "done". */
  findResolved() {
    return this.prisma.resolvedHazard.findMany({ orderBy: { resolvedAt: "desc" } });
  }

  /**
   * Pick the nearest free ranger to the hazard and create a Task.
   * Mirrors the assign() logic in src/store/tasks.ts.
   */
  async assign(dto: AssignTaskDto) {
    const { hazardId, baseLat, baseLon } = dto;

    // Everything from the guards to the create runs in one SERIALIZABLE
    // transaction — otherwise two concurrent assigns both pass the
    // "already has an active task" check (double-dispatch), or both compute
    // the same busy-set and double-book one ranger. Postgres aborts the
    // loser with a serialization error instead.
    // TODO(collaborator): the durable fix is a partial unique index on
    // Task(hazardId) WHERE status = 'enroute' — needs a Prisma migration
    // against the shared Supabase DB, deliberately not run from here.
    const task = await this.prisma.$transaction(
      async (tx: PrismaTx) => {
        // Guard: already being worked or resolved
        const existing = await tx.task.findFirst({
          where: { hazardId, status: "enroute" },
        });
        if (existing) throw new BadRequestException("Hazard already has an active task");

        const alreadyResolved = await tx.resolvedHazard.findUnique({ where: { hazardId } });
        if (alreadyResolved) throw new BadRequestException("Hazard already resolved");

        const hazard = await tx.incident.findUnique({ where: { id: hazardId } });
        if (!hazard) throw new NotFoundException(`Incident ${hazardId} not found`);

        // Busy rangers = those currently enroute on another task
        const busyTasks = await tx.task.findMany({ where: { status: "enroute" } });
        const busyIds = new Set(busyTasks.map((t) => t.rangerId));

        const allPersonnel = await tx.personnel.findMany();
        const available = allPersonnel.filter((p) => !busyIds.has(p.id));
        if (available.length === 0) throw new BadRequestException("No rangers available");

        const targetLat = baseLat + hazard.offsetLat;
        const targetLon = baseLon + hazard.offsetLon;

        // Pick nearest by flat-earth distance (fine at sector scale)
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

        return tx.task.create({
          data: { hazardId, rangerId: nearest.id, status: "enroute", unitLat, unitLon },
          include: { hazard: true, ranger: true },
        });
      },
      { isolationLevel: "Serializable" },
    );

    this.gateway.emit("task-update", {
      hazardId: task.hazardId,
      rangerId: task.rangerId,
      status: task.status,
      unitLat: task.unitLat,
      unitLon: task.unitLon,
      rangerName: task.ranger.name,
      callsign: task.ranger.callsign,
    });

    return task;
  }

  /**
   * Personel-driven status change. `arrived` now means "field unit reports
   * the task complete, awaiting radar confirmation" — it deliberately no
   * longer writes a ResolvedHazard. Radar closes the loop via `confirm()`;
   * until then the hazard stays visibly active on both sides. This is the
   * two-step handshake (mirrors victim report→confirm and evac request→accept)
   * the operator asked for so a unit can't silently mark its own work done.
   */
  async updateStatus(id: string, dto: UpdateTaskStatusDto) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { hazard: true, ranger: true },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);

    // Idempotent — a repeated "reported done" is a no-op, no re-emit.
    if (task.status === dto.status) return task;

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.unitLat !== undefined && { unitLat: dto.unitLat }),
        ...(dto.unitLon !== undefined && { unitLon: dto.unitLon }),
      },
      include: { hazard: true, ranger: true },
    });

    // `task-update` with status=arrived is the "awaiting confirmation" signal
    // radar's Comm Center surfaces as a pending card.
    this.gateway.emit("task-update", {
      hazardId: updated.hazardId,
      rangerId: updated.rangerId,
      status: updated.status,
      unitLat: updated.unitLat,
      unitLon: updated.unitLon,
      rangerName: updated.ranger.name,
      callsign: updated.ranger.callsign,
    });

    return updated;
  }

  /**
   * Radar confirms a field unit's completion report — only now is the
   * ResolvedHazard written and the live task cleared. This is the second
   * half of the handshake; without it, `arrived` tasks sit pending forever.
   */
  async confirm(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { hazard: true, ranger: true },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    if (task.status !== "arrived") {
      throw new BadRequestException("Only a unit that reported done (arrived) can be confirmed");
    }

    // Resolution record + live-task removal land together or not at all.
    await this.prisma.$transaction(async (tx: PrismaTx) => {
      await tx.resolvedHazard.upsert({
        where: { hazardId: task.hazardId },
        update: {},
        create: {
          hazardId: task.hazardId,
          rangerId: task.ranger.id,
          rangerName: task.ranger.name,
          callsign: task.ranger.callsign,
        },
      });
      await tx.task.delete({ where: { id } });
    });

    this.gateway.emit("task-confirmed", {
      hazardId: task.hazardId,
      rangerId: task.rangerId,
      rangerName: task.ranger.name,
      callsign: task.ranger.callsign,
    });
    return { ok: true };
  }

  /**
   * Radar rejects a completion report ("not done, keep working") — the unit
   * goes back to enroute/on-scene and the hazard stays active, no
   * ResolvedHazard written.
   */
  async reject(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { hazard: true, ranger: true },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    if (task.status !== "arrived") {
      throw new BadRequestException("Only a pending completion report can be rejected");
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: "enroute" },
      include: { hazard: true, ranger: true },
    });

    this.gateway.emit("task-rejected", {
      hazardId: updated.hazardId,
      rangerId: updated.rangerId,
      rangerName: updated.ranger.name,
      callsign: updated.ranger.callsign,
    });
    return updated;
  }

  /**
   * A field unit takes a hazard on its own initiative (personel-initiated,
   * vs radar's nearest-free-unit `assign`). Validated in the same
   * SERIALIZABLE transaction so it can't race radar's dispatch — whoever
   * commits first wins, the other gets a 400 instead of a second unit on the
   * same hazard.
   */
  async selfAssign(dto: SelfAssignTaskDto) {
    const { hazardId, rangerId, unitLat, unitLon } = dto;

    const task = await this.prisma.$transaction(
      async (tx: PrismaTx) => {
        const existing = await tx.task.findFirst({ where: { hazardId, status: "enroute" } });
        if (existing) throw new BadRequestException("Hazard already has an active unit");
        const alreadyResolved = await tx.resolvedHazard.findUnique({ where: { hazardId } });
        if (alreadyResolved) throw new BadRequestException("Hazard already resolved");

        const hazard = await tx.incident.findUnique({ where: { id: hazardId } });
        if (!hazard) throw new NotFoundException(`Incident ${hazardId} not found`);
        const ranger = await tx.personnel.findUnique({ where: { id: rangerId } });
        if (!ranger) throw new NotFoundException(`Personnel ${rangerId} not found`);

        // This unit can't already be enroute on something else.
        const busy = await tx.task.findFirst({ where: { rangerId, status: "enroute" } });
        if (busy) throw new BadRequestException("This unit is already on another task");

        return tx.task.create({
          data: { hazardId, rangerId, status: "enroute", unitLat, unitLon },
          include: { hazard: true, ranger: true },
        });
      },
      { isolationLevel: "Serializable" },
    );

    this.gateway.emit("task-update", {
      hazardId: task.hazardId,
      rangerId: task.rangerId,
      status: task.status,
      unitLat: task.unitLat,
      unitLon: task.unitLon,
      rangerName: task.ranger.name,
      callsign: task.ranger.callsign,
      selfAssigned: true,
    });
    return task;
  }

  async updatePosition(id: string, dto: UpdatePositionDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);

    await this.prisma.task.update({ where: { id }, data: { unitLat: dto.lat, unitLon: dto.lon } });

    this.gateway.emit("ranger-position", { rangerId: task.rangerId, lat: dto.lat, lon: dto.lon });
    return { ok: true };
  }
}
