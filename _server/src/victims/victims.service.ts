import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";
import { SosPingDto, RangerRefDto } from "./dto/victim.dto";

@Injectable()
export class VictimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  async ping(dto: SosPingDto) {
    // Deliberately doesn't force `status: "active"` on update — the SOS page
    // re-beacons every 15s for as long as it's left open, including after
    // radar has already confirmed this person rescued. Reviving them back to
    // "active" on the very next heartbeat would make "rescued" meaningless.
    const victim = await this.prisma.victim.upsert({
      where: { id: dto.id },
      create: { id: dto.id, label: dto.label, lat: dto.lat, lon: dto.lon },
      update: { label: dto.label, lat: dto.lat, lon: dto.lon },
    });
    if (victim.status === "active") this.gateway.emit("victim-sos", victim);
    return victim;
  }

  /** Unresolved victims — still active, whether or not a report is pending confirmation. Rescued (confirmed) ones drop off. */
  active() {
    return this.prisma.victim.findMany({ where: { status: "active" }, orderBy: { lastSeenAt: "desc" } });
  }

  /** Radar dispatches a specific unit toward the victim's location — doesn't change status, just records who's headed there. */
  async assignRanger(id: string, dto: RangerRefDto) {
    const victim = await this.updateAndBroadcast(id, {
      assignedRangerId: dto.rangerId,
      assignedRangerName: dto.rangerName,
      assignedCallsign: dto.callsign,
    });
    return victim;
  }

  /** Personel reports the victim found/secured — awaiting radar's confirmation, not yet rescued. */
  async report(id: string, dto: RangerRefDto) {
    return this.updateAndBroadcast(id, {
      reportedRangerId: dto.rangerId,
      reportedRangerName: dto.rangerName,
      reportedCallsign: dto.callsign,
    });
  }

  /** Radar rejects the field report — victim goes back to plain "active", nobody credited yet. */
  async rejectReport(id: string) {
    return this.updateAndBroadcast(id, {
      reportedRangerId: null,
      reportedRangerName: null,
      reportedCallsign: null,
    });
  }

  /** Radar confirms the field report — only now is the victim actually marked rescued. */
  async confirmRescue(id: string) {
    const victim = await this.prisma.victim.findUnique({ where: { id } });
    if (!victim) throw new NotFoundException(`Victim ${id} not found`);
    if (victim.status === "rescued") return victim; // idempotent — no re-emit
    const updated = await this.prisma.victim.update({ where: { id }, data: { status: "rescued" } });
    this.gateway.emit("victim-rescued", { id });
    return updated;
  }

  private async updateAndBroadcast(id: string, data: Record<string, string | null>) {
    const victim = await this.prisma.victim.findUnique({ where: { id } });
    if (!victim) throw new NotFoundException(`Victim ${id} not found`);
    // A late field report or dispatch against an already-confirmed rescue
    // must not re-broadcast `victim-sos` — that resurrects the victim onto
    // every client's active SOS list.
    if (victim.status === "rescued") {
      throw new BadRequestException(`Victim ${id} already rescued`);
    }
    const updated = await this.prisma.victim.update({ where: { id }, data });
    this.gateway.emit("victim-sos", updated);
    return updated;
  }
}
