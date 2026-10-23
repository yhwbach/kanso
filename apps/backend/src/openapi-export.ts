import "reflect-metadata";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/app.module";
import { buildOpenApiDocument } from "@/openapi";

async function main() {
  process.env.LOCAL_AI = "off";
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  await app.init();
  const out = path.resolve(__dirname, "../contracts/openapi.json");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
  console.log(`Wrote ${out}`);
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
