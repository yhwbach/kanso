import { Injectable, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { z } from "zod";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";
import { DOMAIN_EVENTS, type ToolScaffoldedEvent } from "@/platform/events/domain-events";
import type { KansoTool, ToolSource } from "@/platform/tools/tool.types";
import { CodegenService } from "@/codegen";
import { ExtensionLoader } from "@/tools/services/extension-loader.service";
import type { ToolView } from "@/tools/dto/tools.dto";

@Injectable()
export class ToolsService implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly loader: ExtensionLoader,
    private readonly codegen: CodegenService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    this.registry.register({
      name: "create_tool",
      description:
        "Create a new automation from a natural language description, such as 'every day at 10 PM, check my front door is locked and alert me if it is not'. The automation is generated, validated, and hot-loaded so it is callable immediately. When the description names a time, Kanso runs it on its own every day at that time and notifies the user. Reply with the returned message.",
      inputSchema: z.object({ description: z.string().min(8).max(600) }),
      source: "core",
      execute: async (input, ctx) => {
        const r = await this.scaffold(ctx.userId, String(input.description));
        const when = r.daily ? ` It will run on its own every day at ${this.spokenTime(r.daily)} and let you know.` : "";
        return { ok: true, tool: r.tool, fileName: r.fileName, engine: r.engine, daily: r.daily, message: `Automation ready: ${r.tool.name.replace(/_/g, " ")}. ${r.tool.description}${when}` };
      },
    });

    this.registry.register({
      name: "list_tools",
      description: "List every tool currently registered, including user-created extensions.",
      inputSchema: z.object({}),
      source: "core",
      execute: () => ({ tools: this.list().map((t) => ({ name: t.name, description: t.description, source: t.source })) }),
    });
  }

  list(): ToolView[] {
    return this.registry.list().map((t) => this.view(t));
  }

  view(tool: KansoTool): ToolView {
    return {
      name: tool.name,
      description: tool.description,
      source: tool.source,
      fileName: tool.filePath?.split(/[\\/]/).pop(),
      registeredAt: tool.registeredAt,
      inputSchema: this.registry.jsonSchema(tool),
    };
  }

  async scaffold(userId: string, intent: string) {
    const generated = await this.codegen.generateTool(intent);
    const { tool, record } = await this.loader.install(generated.fileName, generated.code, { intent, engine: generated.engine, userId });
    const view = this.view(tool);
    const event: ToolScaffoldedEvent = { userId, intent, engine: generated.engine, tool: { name: view.name, source: "extension", description: view.description, fileName: view.fileName }, fileName: generated.fileName, code: generated.code, daily: record.daily };
    this.events.emit(DOMAIN_EVENTS.TOOL_SCAFFOLDED, event);
    return { tool: view, fileName: generated.fileName, code: generated.code, engine: generated.engine, modelId: generated.modelId, ms: generated.ms, daily: record.daily };
  }

  async run(userId: string, name: string, input: Record<string, unknown>, source: ToolSource) {
    const started = Date.now();
    const result = await this.registry.invoke(name, input, this.registry.context(userId, source));
    return { result, ms: Date.now() - started };
  }

  private spokenTime(daily: string) {
    const [h, m] = daily.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }
}
