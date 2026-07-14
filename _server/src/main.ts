import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: ["http://localhost:1420", "tauri://localhost"],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  });

  // ─── Global Validation Pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── WebSocket (Socket.IO) ──────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ─── Swagger / OpenAPI ──────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle("Offroute API")
    .setDescription(
      "Backend API for Offroute — disaster management system. " +
        "All endpoints consumed by the Preact frontend via Axios. " +
        "WebSocket events documented in the gateway section.",
    )
    .setVersion("1.0")
    .addTag("personnel", "Ranger / field personel roster")
    .addTag("incidents", "Incident / hazard reports")
    .addTag("tasks", "Ranger task assignment & tracking")
    .addTag("flare", "Major incident (FLARE) alerts")
    .addTag("evacuation", "Evacuation point requests & confirmations")
    .addTag("messages", "Geotagged status messages from personel")
    .addTag("comms", "Comm Center radio log")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Offroute API running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
