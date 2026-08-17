import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma/prisma.service";

/**
 * AppController gained a PrismaService dependency when the /health endpoint was
 * added, but this spec was never updated — it still built the controller with
 * only AppService, so Nest failed to resolve the constructor and `npm test`
 * errored out before running a single assertion.
 *
 * PrismaService is stubbed rather than real: these are unit tests and must not
 * need a live Postgres.
 */
describe("AppController", () => {
  let appController: AppController;
  let personnelCount: jest.Mock;

  beforeEach(async () => {
    personnelCount = jest.fn().mockResolvedValue(0);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: { personnel: { count: personnelCount } },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("returns the service greeting", () => {
      expect(appController.getHello()).toBe("Hello World!");
    });
  });

  describe("health", () => {
    it("reports ok and db:true when the database answers", async () => {
      const result = await appController.health();

      expect(result.ok).toBe(true);
      expect(result.db).toBe(true);
      expect(typeof result.ts).toBe("number");
      expect(personnelCount).toHaveBeenCalledTimes(1);
    });

    it("reports db:false but stays ok when the database is unreachable", async () => {
      // The distinction radar's System Monitor relies on: the API is alive,
      // its database is not. It must not surface as a total outage.
      personnelCount.mockRejectedValue(new Error("connection refused"));

      const result = await appController.health();

      expect(result.ok).toBe(true);
      expect(result.db).toBe(false);
    });
  });
});
