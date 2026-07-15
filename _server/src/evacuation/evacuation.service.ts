import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService, type PrismaTx } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";
import { CreateEvacRequestDto } from "./dto/evacuation.dto";

@Injectable()
export class EvacuationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  getPoints() {
    return this.prisma.evacuationPoint.findMany({ orderBy: { createdAt: "desc" } });
  }

  getPending() {
    return this.prisma.evacuationRequest.findMany({ where: { accepted: null }, orderBy: { createdAt: "desc" } });
  }

  /** Ranger offers their position as a safe evacuation point — radar must accept/reject. */
  async createRequest(dto: CreateEvacRequestDto) {
    // One open request per ranger — a re-send while the first is still
    // pending returns the existing one instead of stacking duplicate cards.
    const open = await this.prisma.evacuationRequest.findFirst({
      where: { rangerId: dto.rangerId, accepted: null },
    });
    if (open) return open;

    const req = await this.prisma.evacuationRequest.create({ data: dto });
    this.gateway.emit("evac-request", req);
    return req;
  }

  /** Radar accepts — creates an EvacuationPoint and broadcasts confirmation. */
  async accept(id: string) {
    const req = await this.prisma.evacuationRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException(`EvacuationRequest ${id} not found`);
    if (req.accepted !== null) throw new BadRequestException("Request already decided");

    // Decision flag + point creation land together or not at all.
    const point = await this.prisma.$transaction(async (tx: PrismaTx) => {
      await tx.evacuationRequest.update({ where: { id }, data: { accepted: true } });
      return tx.evacuationPoint.create({
        data: {
          rangerId: req.rangerId,
          rangerName: req.rangerName,
          callsign: req.callsign,
          lat: req.atLat,
          lon: req.atLon,
        },
      });
    });

    this.gateway.emit("evac-request-decided", { id, accepted: true });
    this.gateway.emit("evac-confirmed", point);
    return point;
  }

  /** Radar rejects — marks request rejected, no point created. */
  async reject(id: string) {
    const req = await this.prisma.evacuationRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException(`EvacuationRequest ${id} not found`);
    if (req.accepted !== null) throw new BadRequestException("Request already decided");

    const updated = await this.prisma.evacuationRequest.update({ where: { id }, data: { accepted: false } });
    // Without this, other radar clients keep showing the rejected request
    // until a manual refetch (accept had a broadcast, reject had none).
    this.gateway.emit("evac-request-decided", { id, accepted: false });
    return updated;
  }

  /** Radar removes a confirmed point — e.g. it was wrong or needs relocating (a new one can be marked via the normal request/accept flow afterward). Broadcasts removal to every client. */
  async removePoint(id: string) {
    const point = await this.prisma.evacuationPoint.findUnique({ where: { id } });
    if (!point) throw new NotFoundException(`EvacuationPoint ${id} not found`);

    await this.prisma.evacuationPoint.delete({ where: { id } });
    this.gateway.emit("evac-removed", { id });
    return { id };
  }
}
