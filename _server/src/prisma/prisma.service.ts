import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// The Prisma v7 client is generated to _server/generated/prisma — outside both
// src/ and dist/ — so it must be required at runtime rather than imported.
//
// The relative depth is NOT the same in every context: from the compiled
// dist/src/prisma/ it is three levels up, but when the same file runs straight
// from src/prisma/ under ts-jest it is only two. Hardcoding the dist depth is
// why `npm test` used to fail to even load this module. Try both.
// The generated client has no static type here (it is required at runtime, not
// imported), so this mirrors the untyped shape the rest of this file expects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientCtor = new (...args: any[]) => any;

function loadPrismaClient(): { PrismaClient: PrismaClientCtor } {
  const candidates = [
    "../../../generated/prisma/index.js", // dist/src/prisma  -> _server/generated
    "../../generated/prisma/index.js", // src/prisma       -> _server/generated
  ];

  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") throw error;
    }
  }

  throw new Error(
    "Prisma client not found. Run `npx prisma generate` in _server/ before starting the server.",
  );
}

const { PrismaClient: BasePrismaClient } = loadPrismaClient();

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

  /**
   * Interactive transaction passthrough — check-then-write flows (task
   * assignment, FLARE activation) need atomicity or concurrent requests
   * both pass their guards. Works with the pgbouncer transaction-mode
   * pooler: the pg adapter pins each transaction to one connection.
   * Keep transactions short.
   */
  get $transaction() { return this.client.$transaction.bind(this.client); }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    await this.pool.end();
  }
}

/** Model surface available inside an interactive $transaction callback. */
export type PrismaTx = Omit<PrismaService, "$transaction" | "onModuleInit" | "onModuleDestroy">;
