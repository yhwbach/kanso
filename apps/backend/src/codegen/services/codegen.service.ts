import { Injectable, Logger } from "@nestjs/common";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { ConfigService } from "@/platform/config/config.service";
import { CODEGEN_SYSTEM_PROMPT } from "@/codegen/prompt";
import { templateTool } from "@/codegen/services/template";

export interface GeneratedTool {
  code: string;
  fileName: string;
  engine: "bedrock" | "local-template";
  modelId?: string;
  ms: number;
}

@Injectable()
export class CodegenService {
  private readonly logger = new Logger(CodegenService.name);
  private client: BedrockRuntimeClient | null = null;

  constructor(private readonly config: ConfigService) {}

  get configured() {
    return Boolean(this.config.get("AWS_ACCESS_KEY_ID") && this.config.get("AWS_SECRET_ACCESS_KEY") && this.config.get("AWS_REGION"));
  }

  status() {
    return { configured: this.configured, modelId: this.config.get("BEDROCK_MODEL_ID"), region: this.config.get("AWS_REGION") ?? null };
  }

  async generateTool(intent: string): Promise<GeneratedTool> {
    const started = Date.now();
    if (!this.configured) {
      this.logger.warn("AWS credentials are not set. Using the local template generator.");
      const code = templateTool(intent);
      return { code, fileName: this.fileNameFor(code, intent), engine: "local-template", ms: Date.now() - started };
    }
    try {
      const modelId = this.config.get("BEDROCK_MODEL_ID");
      const res = await this.bedrock().send(
        new ConverseCommand({
          modelId,
          system: [{ text: CODEGEN_SYSTEM_PROMPT }],
          messages: [{ role: "user", content: [{ text: `User intent: "${intent}"` }] }],
          inferenceConfig: { maxTokens: 2000, temperature: 0.1 },
        }),
      );
      const text = res.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";
      const code = this.stripFences(text);
      if (!code.includes("export default") || !code.includes("inputSchema")) throw new Error("generated code is not a Kanso tool definition");
      const fileName = this.fileNameFor(code, intent);
      this.logger.log(`Bedrock ${modelId} generated ${fileName} in ${Date.now() - started}ms`);
      return { code, fileName, engine: "bedrock", modelId, ms: Date.now() - started };
    } catch (err) {
      this.logger.warn(`Bedrock generation failed, using the local template: ${(err as Error).message}`);
      const code = templateTool(intent);
      return { code, fileName: this.fileNameFor(code, intent), engine: "local-template", ms: Date.now() - started };
    }
  }

  private bedrock() {
    if (!this.client) this.client = new BedrockRuntimeClient({ region: this.config.get("AWS_REGION") ?? "us-east-1" });
    return this.client;
  }

  /** The tool's own name becomes the file name, so asking for the same automation twice updates one file. */
  private fileNameFor(code: string, intent: string) {
    const match = code.match(/name:\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']/);
    return `${match ? match[1] : intent.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "tool"}.ts`;
  }

  private stripFences(text: string) {
    const m = text.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/);
    return `${(m ? m[1] : text).trim()}\n`;
  }
}
