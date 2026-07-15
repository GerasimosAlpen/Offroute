import { Injectable } from "@nestjs/common";
import { PrismaService, type PrismaTx } from "../prisma/prisma.service";
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
    // Sequence read + create in one SERIALIZABLE transaction, and activation
    // is idempotent while a FLARE is already active — two concurrent
    // activations would otherwise both read the same latest sequence and
    // create two simultaneously-active alerts with duplicate numbers.
    const { flare, created } = await this.prisma.$transaction(
      async (tx: PrismaTx) => {
        const last = await tx.flareAlert.findFirst({ orderBy: { createdAt: "desc" } });
        if (last && last.status === "active") return { flare: last, created: false };
        const nextSeq = last ? last.sequence + 1 : 1;
        const fresh = await tx.flareAlert.create({
          data: { status: "active", sequence: nextSeq },
        });
        return { flare: fresh, created: true };
      },
      { isolationLevel: "Serializable" },
    );

    if (created) {
      this.gateway.emit("flare-broadcast", {
        flareId: flare.id,
        sequence: flare.sequence,
        status: flare.status,
      });
    }

    return flare;
  }

  /** Radar stands down an active FLARE — manual, or the frontend's own soft auto-expiry backstop. No-ops if there's nothing active to stand down. */
  async deactivate() {
    const last = await this.getCurrent();
    if (!last || last.status === "calm") return last;

    const flare = await this.prisma.flareAlert.update({
      where: { id: last.id },
      data: { status: "calm" },
    });

    this.gateway.emit("flare-broadcast", {
      flareId: flare.id,
      sequence: flare.sequence,
      status: flare.status,
    });

    return flare;
  }
}
