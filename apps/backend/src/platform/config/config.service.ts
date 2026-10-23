import { Injectable } from "@nestjs/common";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
  MONGODB_URI: z.string().optional(),
  MONGODB_DATA_DIR: z.string().optional(),
  LOCAL_AI: z.enum(["on", "off"]).default("on"),
  PRELOAD_MODELS: z.enum(["true", "false"]).default("true"),
  EXTENSIONS_DIR: z.string().optional(),
  WEB_DIR: z.string().optional(),
  TAVUS_API_KEY: z.string().optional(),
  TAVUS_PAL_ID: z.string().optional(),
  TAVUS_FACE_ID: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  BEDROCK_MODEL_ID: z.string().default("anthropic.claude-opus-5-5"),
  MCP_AUTH: z.enum(["optional", "required"]).default("optional"),
  APP_ACCESS: z.enum(["local", "public"]).default("local"),
});

export type Env = z.infer<typeof schema>;

@Injectable()
export class ConfigService {
  private readonly env: Env;

  constructor() {
    const cleaned = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v?.trim() === "" ? undefined : v]));
    const parsed = schema.safeParse(cleaned);
    if (!parsed.success) {
      throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    }
    this.env = parsed.data;
  }

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  get publicUrl(): string {
    return (this.env.PUBLIC_URL ?? `http://localhost:${this.env.PORT}`).replace(/\/$/, "");
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  }
}
