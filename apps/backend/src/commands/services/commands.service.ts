import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DOMAIN_EVENTS, type CommandHandledEvent } from "@/platform/events/domain-events";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";
import { HomeService, describeDuration } from "@/home";
import { LocalAiService } from "@/local-ai";
import { CommandLog, CommandLogDocument } from "@/commands/entities/command-log.entity";
import { parseIntents, type Intent } from "@/commands/services/intent-router";
import type { CommandLogView, CommandResult, TelemetrySummary } from "@/commands/dto/commands.dto";

type Action = Record<string, unknown> & { kind: string; ok: boolean };

@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name);

  constructor(
    @InjectModel(CommandLog.name) private readonly logs: Model<CommandLogDocument>,
    private readonly home: HomeService,
    private readonly ai: LocalAiService,
    private readonly registry: ToolRegistry,
    private readonly events: EventEmitter2,
  ) {}

  async handleText(userId: string, rawText: string, opts: { source?: "local" | "pal"; latency?: Record<string, number> } = {}): Promise<CommandResult> {
    const latency: Record<string, number> = { ...(opts.latency ?? {}) };
    const engines: Record<string, string> = {};
    const started = Date.now();
    const source = opts.source ?? "local";
    const user = await this.home.getUser(userId);

    const spoken = this.removeFillers(rawText);
    let sanitized = spoken;
    let piiDetected = false;
    let piiLabels: string[] = [];
    if (user.privacyEnabled) {
      const devices = await this.home.listDevices(userId);
      const r = await this.ai.redactPii(spoken, devices.flatMap((d) => [d.name, d.room]));
      sanitized = r.redactedText;
      piiDetected = r.piiDetected;
      piiLabels = r.labels;
      latency.redact = r.ms;
      engines.redact = r.engine;
    } else {
      latency.redact = 0;
      engines.redact = "disabled";
    }

    const tagged = await this.ai.topics(sanitized);
    latency.topics = tagged.ms;
    engines.topics = tagged.engine;

    const routeStart = Date.now();
    const intents = parseIntents(sanitized);
    latency.route = Date.now() - routeStart;

    const execStart = Date.now();
    const { actions, replies, cloudEgress } = await this.execute(userId, intents, source);
    latency.execute = Date.now() - execStart;
    latency.total = Date.now() - started + (opts.latency?.transcribe ?? 0);

    const reply = this.joinReplies(replies);
    const telemetry = actions.map((a) => ({ action: a.kind, ...(a.deviceType ? { device: String(a.deviceType) } : {}) }));
    const log = await this.logs.create({ userId: new Types.ObjectId(userId), rawText, sanitizedText: sanitized, piiDetected, piiLabels, topics: tagged.topics, source, latency, actions, reply, telemetry, cloudEgress });

    const result: CommandResult = { ok: actions.every((a) => a.ok), transcript: rawText, sanitized, piiDetected, piiLabels, topics: tagged.topics, actions, reply, latency, cloudEgress, engines, logId: log._id.toString() };
    const event: CommandHandledEvent = { userId, logId: result.logId, transcript: rawText, sanitized, piiDetected, reply, actions, latency, cloudEgress, source, timestamp: log.timestamp!.toISOString() };
    this.events.emit(DOMAIN_EVENTS.COMMAND_HANDLED, event);
    return result;
  }

  async recent(userId: string, limit = 50): Promise<CommandLogView[]> {
    const docs = await this.logs.find({ userId: new Types.ObjectId(userId) }).sort({ timestamp: -1 }).limit(limit).exec();
    return docs.map((d) => ({
      id: d._id.toString(),
      rawText: d.rawText,
      sanitizedText: d.sanitizedText,
      piiDetected: d.piiDetected,
      piiLabels: d.piiLabels,
      topics: d.topics,
      source: d.source,
      latency: d.latency,
      actions: d.actions,
      reply: d.reply,
      telemetry: d.telemetry,
      cloudEgress: d.cloudEgress,
      timestamp: d.timestamp!,
    }));
  }

  async telemetry(userId: string): Promise<TelemetrySummary> {
    const docs = await this.logs.find({ userId: new Types.ObjectId(userId) }).sort({ timestamp: -1 }).limit(500).exec();
    const byAction: Record<string, number> = {};
    const byTopic: Record<string, number> = {};
    let piiRedacted = 0;
    let cloudEgressCount = 0;
    for (const d of docs) {
      if (d.piiDetected) piiRedacted++;
      if (d.cloudEgress) cloudEgressCount++;
      for (const t of d.telemetry) byAction[t.action] = (byAction[t.action] ?? 0) + 1;
      for (const t of d.topics) byTopic[t] = (byTopic[t] ?? 0) + 1;
    }
    const avg = (key: string) => {
      const values = docs.map((d) => d.latency?.[key]).filter((v): v is number => typeof v === "number");
      return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    };
    return {
      commands: docs.length,
      piiRedacted,
      cloudEgressCount,
      localOnlyCount: docs.length - cloudEgressCount,
      byAction,
      byTopic,
      avgLatency: { total: avg("total"), transcribe: avg("transcribe"), redact: avg("redact"), route: avg("route"), execute: avg("execute") },
      recentTags: docs.slice(0, 20).map((d) => ({ at: d.timestamp!, tags: d.telemetry, cloud: d.cloudEgress })),
    };
  }

  private async execute(userId: string, intents: Intent[], source: "local" | "pal") {
    const actions: Action[] = [];
    const replies: string[] = [];
    let cloudEgress = false;
    if (!intents.length) return { actions, replies: ["Sorry, I didn't catch that."], cloudEgress };

    const ctx = this.registry.context(userId, source);
    for (const intent of intents) {
      try {
        switch (intent.kind) {
          case "power": {
            const r = await this.home.setPower(userId, intent.target, intent.on);
            actions.push({ kind: "control_device", ok: r.ok, error: r.error, device: r.device?.id, deviceType: r.device?.type, on: intent.on });
            replies.push(r.message);
            break;
          }
          case "lock": {
            const r = await this.home.setLock(userId, intent.target, intent.locked);
            actions.push({ kind: "control_device", ok: r.ok, error: r.error, device: r.device?.id, deviceType: "lock", locked: intent.locked });
            replies.push(r.message);
            break;
          }
          case "timer": {
            const timer = this.home.createTimer(userId, intent.durationMs, intent.label);
            actions.push({ kind: "set_timer", ok: true, timerId: timer.id, durationMs: intent.durationMs });
            replies.push(`Okay, I've started a ${describeDuration(intent.durationMs).replace(/ (\w+?)s?$/, "-$1")} timer.`);
            break;
          }
          case "cancel_timer": {
            const timers = this.home.listTimers(userId);
            for (const t of timers) this.home.cancelTimer(userId, t.id);
            actions.push({ kind: "cancel_timer", ok: true, count: timers.length });
            replies.push(timers.length ? `Okay, I've cancelled ${timers.length === 1 ? "your timer" : `all ${timers.length} timers`}.` : "You don't have any timers running.");
            break;
          }
          case "temperature": {
            const r = await this.home.setTemperature(userId, intent.value);
            actions.push({ kind: "set_temperature", ok: r.ok, deviceType: "thermostat", value: intent.value });
            replies.push(r.message);
            break;
          }
          case "adjust_temperature": {
            const r = await this.home.adjustTemperature(userId, intent.delta);
            actions.push({ kind: "set_temperature", ok: r.ok, deviceType: "thermostat", value: r.device?.temperature });
            replies.push(r.message);
            break;
          }
          case "summary": {
            const r = await this.home.summary(userId, intent.scope);
            actions.push({ kind: "home_summary", ok: r.ok });
            replies.push(r.message);
            break;
          }
          case "status": {
            const r = await this.home.status(userId, intent.target);
            actions.push({ kind: "device_status", ok: r.ok, error: r.error, device: r.device?.id, deviceType: r.device?.type });
            replies.push(r.message);
            break;
          }
          case "diagnose": {
            const r = await this.home.diagnose(userId, intent.target);
            actions.push({ kind: "diagnose_device", ok: r.ok, healthy: r.healthy });
            replies.push(r.diagnosis);
            break;
          }
          case "restart_hub": {
            const r = await this.home.restartHub(userId, intent.target);
            actions.push({ kind: "restart_hub", ok: r.ok, deviceType: "hub" });
            replies.push(r.message);
            break;
          }
          case "scaffold": {
            cloudEgress = true;
            const r = (await this.registry.invoke("create_tool", { description: intent.description }, ctx)) as { tool: { name: string }; engine: string; fileName: string };
            actions.push({ kind: "create_tool", ok: true, tool: r.tool.name, engine: r.engine, fileName: r.fileName });
            replies.push(`All set. I've made you a new automation. ${this.promise(intent.description)}`);
            break;
          }
          case "list_tools": {
            const extensions = this.registry.list().filter((t) => t.source === "extension");
            actions.push({ kind: "list_tools", ok: true, count: extensions.length });
            replies.push(extensions.length ? `${extensions.length} custom tool${extensions.length === 1 ? "" : "s"}: ${extensions.map((t) => t.name).join(", ")}.` : 'No custom tools yet. Say "create a tool that..." to make one.');
            break;
          }
          case "run_tool": {
            const tool = this.registry.list().find((t) => t.name === intent.name || t.name.includes(intent.name));
            if (!tool) {
              actions.push({ kind: "run_tool", ok: false, error: "TOOL_NOT_FOUND" });
              replies.push(`I don't have a tool called ${intent.name.replace(/_/g, " ")}.`);
              break;
            }
            const r = (await this.registry.invoke(tool.name, intent.args, ctx)) as { message?: string };
            actions.push({ kind: "run_tool", ok: true, tool: tool.name });
            replies.push(r?.message ?? `${tool.name} ran.`);
            break;
          }
          case "unknown": {
            const words = intent.text.split(/\s+/);
            const match = this.registry.list().find((t) => t.source === "extension" && words.filter((w) => w.length > 2 && t.name.includes(w)).length >= 2);
            if (match) {
              const r = (await this.registry.invoke(match.name, {}, ctx)) as { message?: string };
              actions.push({ kind: "run_tool", ok: true, tool: match.name });
              replies.push(r?.message ?? `${match.name} ran.`);
            } else {
              actions.push({ kind: "unknown", ok: false });
              replies.push("Sorry, I didn't catch that. You can ask me to turn on a light, lock a door, set a timer, or check the temperature.");
            }
            break;
          }
        }
      } catch (err) {
        this.logger.warn(`${intent.kind} failed: ${(err as Error).message}`);
        actions.push({ kind: intent.kind, ok: false, error: (err as Error).message });
        replies.push(`That didn't work: ${(err as Error).message}`);
      }
    }
    return { actions, replies, cloudEgress };
  }

  /** "Okay, the lights are on." + "Okay, I've started a timer." reads as one answer, not two. */
  private joinReplies(replies: string[]): string {
    return replies
      .map((r, i) => {
        if (i === 0) return r;
        const rest = r.replace(/^(?:Okay|Done|All set)[,.]\s*/, "");
        return rest.charAt(0).toUpperCase() + rest.slice(1);
      })
      .join(" ")
      .trim();
  }

  private promise(description: string) {
    const d = description.replace(/^(that|which|to)\s+/, "").replace(/\bmy\b/g, "your").replace(/\bme\b/g, "you").replace(/\bi\b/g, "you");
    return `It ${d.charAt(0).toLowerCase()}${d.slice(1)}.`.replace(/\.\.$/, ".");
  }

  /** Drops spoken fillers and stutters ("um", "uh", "the the") so the words that matter reach the router. */
  private removeFillers(text: string): string {
    return text
      .replace(/\b(?:u+m+|u+h+m*|e+r+m+|e+r+|h+m+|m+h*m+|a+h+|you know|i mean|sort of|kind of)\b/gi, " ")
      .replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1")
      .replace(/\s*,\s*(?:,\s*)+/g, ", ")
      .replace(/(^|[.?!]\s*),\s*/g, "$1")
      .replace(/\s+([,.?!])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s,]+/, "")
      .trim();
  }
}
