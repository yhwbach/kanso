import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { ApiErrorResponse } from "@/platform/http/api-error";

export const DOCS_PATH = "api/docs";

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Kanso API")
    .setDescription(
      [
        "Local-first voice control. The web app talks to this API; the Tavus PAL and Alexa+ talk to the MCP endpoint at /mcp, which is not part of this document.",
        "",
        "Identity: there is no login. POST /api/onboard returns a user id, and every other call takes that id in the body or query. When it is left out, the most recently onboarded user is used.",
        "",
        "Live updates: subscribe to GET /api/events for server-sent events instead of polling.",
        "",
        "Errors: failures return { statusCode, message, error }.",
      ].join("\n"),
    )
    .setVersion("0.1.0")
    .addServer("http://localhost:3000", "Local")
    .build();
  return SwaggerModule.createDocument(app, config, { extraModels: [ApiErrorResponse] });
}

export function setupOpenApi(app: INestApplication) {
  SwaggerModule.setup(DOCS_PATH, app, buildOpenApiDocument(app), { jsonDocumentUrl: `${DOCS_PATH}-json` });
}
