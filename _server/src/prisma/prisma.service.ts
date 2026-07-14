import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma v7 generated client must be required (not imported) so the path is
// resolved at runtime from the dist/ folder correctly. The generated/prisma
// folder is at the _server root level, not inside dist/.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: BasePrismaClient } = require("../../../generated/prisma/index.js");

/**
 * Global Prisma service using PrismaPg adapter (required by Prisma v7).
 * DATABASE_URL uses the pgbouncer transaction-mode pooler at runtime.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly client: InstanceType<typeof BasePrismaClient>;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(this.pool);
    this.client = new BasePrismaClient({ adapter });
  }

  get personnel() { return this.client.personnel; }
  get incident() { return this.client.incident; }
  get task() { return this.client.task; }
  get resolvedHazard() { return this.client.resolvedHazard; }
  get messagePin() { return this.client.messagePin; }
  get commsEntry() { return this.client.commsEntry; }
  get evacuationPoint() { return this.client.evacuationPoint; }
  get evacuationRequest() { return this.client.evacuationRequest; }
  get flareAlert() { return this.client.flareAlert; }
  get flareDispatch() { return this.client.flareDispatch; }
  get victim() { return this.client.victim; }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    await this.pool.end();
  }
}
