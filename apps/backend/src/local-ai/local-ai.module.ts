import { Module, OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";
import { LocalAiService } from "@/local-ai/services/local-ai.service";
import { LocalAiController } from "@/local-ai/local-ai.controller";

@Module({
  providers: [LocalAiService],
  controllers: [LocalAiController],
  exports: [LocalAiService],
})
export class LocalAiModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly ai: LocalAiService,
  ) {}

  onModuleInit() {
    this.registry.register({
      name: "redact_text",
      description: "Run on-device PII redaction over text and return the sanitized version. Nothing leaves the machine.",
      inputSchema: z.object({ text: z.string().max(4000) }),
      source: "core",
      execute: (input) => this.ai.redactPii(String(input.text)),
    });
  }
}
