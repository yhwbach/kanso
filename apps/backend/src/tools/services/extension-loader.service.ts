import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";
import { DOMAIN_EVENTS, type ToolInvalidEvent } from "@/platform/events/domain-events";
import { ConfigService } from "@/platform/config/config.service";
import type { KansoTool } from "@/platform/tools/tool.types";
import { ToolOrigin } from "@/tools/entities/tool-origin.entity";

const ToolExport = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/, "snake_case name required"),
  description: z.string().min(3).max(500),
  inputSchema: z.custom<z.ZodObject<z.ZodRawShape>>((v) => v instanceof z.ZodObject, "inputSchema must be a zod object"),
  execute: z.custom<KansoTool["execute"]>((v) => typeof v === "function", "execute must be a function"),
  schedule: z.object({ daily: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "daily must be a 24-hour time like 20:40") }).optional(),
});

export interface ToolOriginMeta {
  intent?: string;
  engine?: string;
  userId?: string;
}

export interface ExtensionRecord {
  fileName: string;
  toolName?: string;
  status: "loaded" | "error";
  error?: string;
  updatedAt: string;
  intent?: string;
  engine?: string;
  daily?: string;
  userId?: string;
}

@Injectable()
export class ExtensionLoader implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExtensionLoader.name);
  readonly dir: string;
  private readonly records = new Map<string, ExtensionRecord>();
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private readonly installed = new Map<string, string>();
  private watcher: { close(): Promise<void> } | null = null;

  constructor(
    private readonly registry: ToolRegistry,
    private readonly events: EventEmitter2,
    @InjectModel(ToolOrigin.name) private readonly origins: Model<ToolOrigin>,
    config: ConfigService,
  ) {
    this.dir = this.resolveExtensionsDir(config.get("EXTENSIONS_DIR"));
  }

  async onModuleInit() {
    await fs.mkdir(this.dir, { recursive: true });
    const files = (await fs.readdir(this.dir)).filter((f) => this.isToolFile(f));
    for (const f of files) await this.load(path.join(this.dir, f));
    this.logger.log(`Watching ${this.dir} (${files.length} extension${files.length === 1 ? "" : "s"})`);

    const chokidar = await import("chokidar");
    this.watcher = chokidar
      .watch(this.dir, { ignoreInitial: true, depth: 0, awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 } })
      .on("add", (p) => this.isToolFile(p) && this.schedule(p))
      .on("change", (p) => this.isToolFile(p) && this.schedule(p))
      .on("unlink", (p) => this.isToolFile(p) && this.unload(p));
  }

  async onModuleDestroy() {
    await this.watcher?.close();
  }

  list(): ExtensionRecord[] {
    return [...this.records.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((r) => this.withoutOwner(r));
  }

  scheduled(): ExtensionRecord[] {
    return [...this.records.values()].filter((r) => r.status === "loaded" && r.toolName && r.daily);
  }

  readSource(fileName: string) {
    return fs.readFile(this.safePath(fileName), "utf8");
  }

  async install(fileName: string, code: string, meta?: ToolOriginMeta) {
    const filePath = this.safePath(fileName);
    this.installed.set(filePath, this.digest(code));
    await fs.writeFile(filePath, code, "utf8");
    if (meta) await this.origins.updateOne({ fileName: path.basename(filePath) }, { $set: meta }, { upsert: true }).exec();
    const record = await this.load(filePath, meta, false);
    if (record.status === "error" || !record.toolName) throw new Error(record.error ?? "Extension failed to load");
    return { record: this.withoutOwner(record), tool: this.registry.get(record.toolName)! };
  }

  async remove(fileName: string) {
    const filePath = this.safePath(fileName);
    this.unload(filePath);
    if (existsSync(filePath)) await fs.unlink(filePath);
  }

  private schedule(filePath: string) {
    clearTimeout(this.pending.get(filePath));
    this.pending.set(
      filePath,
      setTimeout(() => {
        this.pending.delete(filePath);
        void this.reload(filePath);
      }, 100),
    );
  }

  /** The watcher also sees files written by install, which already loaded them. */
  private async reload(filePath: string) {
    const code = await fs.readFile(filePath, "utf8").catch(() => null);
    if (code !== null && this.digest(code) === this.installed.get(filePath)) return;
    this.installed.delete(filePath);
    await this.load(filePath);
  }

  /** Installs report their own failure to the caller, so only watcher reloads announce it. */
  private async load(filePath: string, meta?: ToolOriginMeta, announce = true): Promise<ExtensionRecord> {
    const fileName = path.basename(filePath);
    const previous = this.records.get(filePath);
    const origin = meta ?? previous ?? (await this.origins.findOne({ fileName }).lean().exec());
    const base = { fileName, updatedAt: new Date().toISOString(), intent: origin?.intent, engine: origin?.engine, userId: origin?.userId };
    try {
      // The query string defeats the module cache so a changed file is re-evaluated.
      const mod = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
      const parsed = ToolExport.safeParse(mod.default ?? Object.values(mod).find((v) => v && typeof v === "object" && "execute" in (v as object)));
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".") || "export"}: ${i.message}`).join("; "));
      const def = parsed.data;
      if (previous?.toolName && previous.toolName !== def.name) this.registry.unregister(previous.toolName);
      await this.retireOthersNamed(def.name, filePath);
      this.registry.register({ name: def.name, description: def.description, inputSchema: def.inputSchema, execute: def.execute, source: "extension", filePath });
      const record: ExtensionRecord = { ...base, toolName: def.name, status: "loaded", daily: def.schedule?.daily };
      this.records.set(filePath, record);
      return record;
    } catch (err) {
      const raw = (err as Error).message ?? String(err);
      this.logger.error(`Invalid extension ${fileName}: ${raw}`);
      const error = this.withoutPaths(raw);
      const record: ExtensionRecord = { ...base, toolName: previous?.toolName, status: "error", error };
      this.records.set(filePath, record);
      if (announce) this.events.emit(DOMAIN_EVENTS.TOOL_INVALID, { fileName, error } satisfies ToolInvalidEvent);
      return record;
    }
  }

  /** Two files cannot own one tool name. The newer file wins and the older one is deleted. */
  private async retireOthersNamed(toolName: string, keep: string) {
    for (const [otherPath, record] of this.records) {
      if (otherPath === keep || record.toolName !== toolName) continue;
      this.records.delete(otherPath);
      this.installed.delete(otherPath);
      await fs.unlink(otherPath).catch(() => undefined);
      await this.origins.deleteOne({ fileName: record.fileName }).exec();
      this.logger.log(`Retired ${record.fileName}: ${toolName} is now defined by ${path.basename(keep)}`);
    }
  }

  private unload(filePath: string) {
    this.installed.delete(filePath);
    void this.origins.deleteOne({ fileName: path.basename(filePath) }).exec();
    const record = this.records.get(filePath);
    if (record?.toolName) this.registry.unregister(record.toolName);
    this.records.delete(filePath);
  }

  private safePath(fileName: string) {
    const base = path.basename(fileName);
    if (!this.isToolFile(base)) throw new Error("Extension files must end in .ts");
    return path.join(this.dir, base);
  }

  private withoutOwner({ userId: _owner, ...record }: ExtensionRecord): ExtensionRecord {
    return record;
  }

  private digest(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }

  private isToolFile(p: string) {
    return p.endsWith(".ts") && !p.endsWith(".d.ts") && !path.basename(p).startsWith("_");
  }

  /** Error text names files by their base name, so machine paths never reach the app. */
  private withoutPaths(message: string) {
    return message
      .replace(/file:\/\/\S+/g, (url) => path.basename(url.split("?")[0]))
      .replace(/(?:[A-Za-z]:)?(?:[\\/][\w.@-]+){2,}/g, (p) => path.basename(p));
  }

  /** The extensions folder sits at the workspace root, next to pnpm-workspace.yaml. */
  private resolveExtensionsDir(configured?: string) {
    if (configured) return path.resolve(configured);
    for (const start of [__dirname, process.cwd()]) {
      for (let dir = start; dir !== path.dirname(dir); dir = path.dirname(dir)) {
        if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return path.join(dir, "extensions");
      }
    }
    return path.resolve(process.cwd(), "extensions");
  }
}
