import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.personnel.findMany({ orderBy: { name: "asc" } });
  }

  findOne(id: string) {
    return this.prisma.personnel.findUnique({ where: { id } });
  }
}
