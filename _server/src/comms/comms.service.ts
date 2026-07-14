import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";

export interface AppendCommsDto {
  sender: string;
  color: string;
  lead: string;
  body: string;
}

@Injectable()
export class CommsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  getHistory() {
    return this.prisma.commsEntry.findMany({ orderBy: { createdAt: "asc" } });
  }

  async append(dto: AppendCommsDto) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const entry = await this.prisma.commsEntry.create({ data: { ...dto, time } });
    this.gateway.emit("comms-message", entry);
    return entry;
  }
}
