import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { z } from "zod";
import { DOMAIN_EVENTS, type ToolEvent, type ToolInvokedEvent } from "@/platform/events/domain-events";
import type { HomeApi, KansoTool, ToolContext, ToolDefinition, ToolSource } from "@/platform/tools/tool.types";

const NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

export type HomeApiFactory = (userId: string) => HomeApi;

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools = new Map<string, KansoTool>();
  private homeApiFactory: HomeApiFactory | null = null;

  constructor(private readonly events: EventEmitter2) {}

  /** The home module installs this at boot so tools can act on devices without the registry importing it. */
  provideHomeApi(factory: HomeApiFactory) {
    this.homeApiFactory = factory;
  }

  register(def: ToolDefinition): KansoTool {
    if (!NAME.test(def.name)) throw new Error(`Invalid tool name "${def.name}". Use letters, digits and underscores.`);
    const existing = this.tools.get(def.name);
    if (existing?.source === "core" && def.source === "extension") {
      throw new Error(`"${def.name}" is a core tool and cannot be replaced by an extension.`);
    }
    const tool: KansoTool = { ...def, registeredAt: new Date().toISOString() };
    this.tools.set(def.name, tool);
    this.logger.log(`Tool registered: ${def.name} (${def.source})`);
    this.events.emit(DOMAIN_EVENTS.TOOL_REGISTERED, this.toEvent(tool));
    return tool;
  }

  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;
    this.tools.delete(name);
    this.logger.log(`Tool unregistered: ${name}`);
    this.events.emit(DOMAIN_EVENTS.TOOL_UNREGISTERED, this.toEvent(tool));
    return true;
  }

  get(name: string): KansoTool | undefined {
    return this.tools.get(name);
  }

  list(): KansoTool[] {
    return [...this.tools.values()].sort((a, b) =>
      a.source === b.source ? a.name.localeCompare(b.name) : a.source === "core" ? -1 : 1,
    );
  }

  jsonSchema(tool: KansoTool): Record<string, unknown> {
    return z.toJSONSchema(tool.inputSchema) as Record<string, unknown>;
  }

  context(userId: string, source: ToolSource): ToolContext {
    if (!this.homeApiFactory) throw new Error("Home API is not available yet");
    return { userId, source, home: this.homeApiFactory(userId), log: (m) => this.logger.log(`[${userId}] ${m}`) };
  }

  async invoke(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const parsed = tool.inputSchema.safeParse(input ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ");
      throw new Error(`Invalid input for ${name}: ${issues}`);
    }
    const started = Date.now();
    const result = await tool.execute(parsed.data as Record<string, unknown>, ctx);
    const event: ToolInvokedEvent = { userId: ctx.userId, tool: name, source: ctx.source, args: input ?? {}, result, ms: Date.now() - started };
    this.events.emit(DOMAIN_EVENTS.TOOL_INVOKED, event);
    return result;
  }

  private toEvent(tool: KansoTool): ToolEvent {
    return { name: tool.name, source: tool.source, description: tool.description, fileName: tool.filePath?.split(/[\\/]/).pop() };
  }
}
