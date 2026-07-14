import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts",
  },
  // Use DIRECT_URL (session-mode pooler) for migrations — pgbouncer transaction
  // mode is incompatible with Prisma Migrate. Runtime PrismaClient reads
  // DATABASE_URL (transaction-mode pooler) from process.env automatically.
  datasource: {
    url: process.env["DIRECT_URL"]!,
  },
});
