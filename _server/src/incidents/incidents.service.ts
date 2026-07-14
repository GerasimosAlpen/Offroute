import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";
import { CreateIncidentDto } from "./dto/create-incident.dto";

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  findAll() {
    return this.prisma.incident.findMany({ orderBy: { reportedAt: "desc" } });
  }

  async create(dto: CreateIncidentDto) {
    const incident = await this.prisma.incident.create({ data: dto });
    this.gateway.emit("incident-new", incident);
    return incident;
  }
}
