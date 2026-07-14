import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";
import { CreateMessagePinDto } from "./dto/message.dto";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  findAll() {
    return this.prisma.messagePin.findMany({ orderBy: { createdAt: "desc" } });
  }

  async addPin(dto: CreateMessagePinDto) {
    const pin = await this.prisma.messagePin.create({ data: dto });
    this.gateway.emit("message-pin", pin);
    return pin;
  }
}
