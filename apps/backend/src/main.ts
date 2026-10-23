import "dotenv/config";
import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import { join } from "node:path";
import { AppModule } from "@/app.module";
import { ConfigService } from "@/platform/config/config.service";
import { DOCS_PATH, setupOpenApi } from "@/openapi";
import { localOnly } from "@/platform/http/local-only";
import { isHomeNetworkOrigin } from "@/platform/http/home-network";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ["log", "warn", "error"] });
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.corsOrigins.includes("*") ? true : (origin, done) => done(null, !origin || config.corsOrigins.includes(origin) || (config.get("APP_ACCESS") === "local" && isHomeNetworkOrigin(origin))),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "Mcp-Session-Id", "Mcp-Protocol-Version"],
    exposedHeaders: ["Mcp-Session-Id"],
  });
  if (config.get("APP_ACCESS") === "local") app.use("/api", localOnly);
  app.use("/api/voice/command", express.raw({ type: "*/*", limit: "25mb" }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // In the single container image the backend also serves the built web app, so everything is on one port.
  const web = config.get("WEB_DIR");
  if (web) {
    app.useStaticAssets(web);
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== "GET" || /^\/(api|mcp|oauth|\.well-known)(\/|$)/.test(req.path) || !req.accepts("html")) return next();
      res.sendFile(join(web, "index.html"));
    });
  }
  setupOpenApi(app);
  app.enableShutdownHooks();
  // The on-device models and the in-memory database can keep the process alive after shutdown, which stalls watch mode restarts.
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => setTimeout(() => process.exit(0), 3000).unref());

  const port = config.get("PORT");
  await app.listen(port);
  Logger.log(`Kanso API on http://localhost:${port} (docs at /${DOCS_PATH}, MCP at /mcp)`, "Bootstrap");
}

void bootstrap();
