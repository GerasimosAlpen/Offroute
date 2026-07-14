import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
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
    const req = await this.prisma.evacuationRequest.create({ data: dto });
    this.gateway.emit("evac-request", req);
    return req;
  }

  /** Radar accepts — creates an EvacuationPoint and broadcasts confirmation. */
  async accept(id: string) {
    const req = await this.prisma.evacuationRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException(`EvacuationRequest ${id} not found`);
    if (req.accepted !== null) throw new BadRequestException("Request already decided");

    await this.prisma.evacuationRequest.update({ where: { id }, data: { accepted: true } });

    const point = await this.prisma.evacuationPoint.create({
      data: {
        rangerId: req.rangerId,
        rangerName: req.rangerName,
        callsign: req.callsign,
        lat: req.atLat,
        lon: req.atLon,
      },
    });

    this.gateway.emit("evac-confirmed", point);
    return point;
  }

  /** Radar rejects — marks request rejected, no point created. */
  async reject(id: string) {
    const req = await this.prisma.evacuationRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException(`EvacuationRequest ${id} not found`);
    if (req.accepted !== null) throw new BadRequestException("Request already decided");

    return this.prisma.evacuationRequest.update({ where: { id }, data: { accepted: false } });
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
