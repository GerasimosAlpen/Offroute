import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";

@Injectable()
export class FlareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  getCurrent() {
    return this.prisma.flareAlert.findFirst({ orderBy: { createdAt: "desc" } });
  }

  async activate() {
    const last = await this.getCurrent();
    const nextSeq = last ? last.sequence + 1 : 1;

    const flare = await this.prisma.flareAlert.create({
      data: { status: "active", sequence: nextSeq },
    });

    this.gateway.emit("flare-broadcast", {
      flareId: flare.id,
      sequence: flare.sequence,
      status: flare.status,
    });

    return flare;
  }
}
