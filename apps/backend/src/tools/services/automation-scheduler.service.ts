import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";
import { HomeService } from "@/home";
import { ExtensionLoader } from "@/tools/services/extension-loader.service";

const TICK_MS = 15_000;

/** Runs automations that have a daily time. Times are local to the machine running Kanso. */
@Injectable()
export class AutomationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationScheduler.name);
  private readonly lastRun = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly loader: ExtensionLoader,
    private readonly registry: ToolRegistry,
    private readonly home: HomeService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    const now = new Date();
    const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today = now.toDateString();
    for (const record of this.loader.scheduled()) {
      if (record.daily !== clock || this.lastRun.get(record.toolName!) === today) continue;
      this.lastRun.set(record.toolName!, today);
      await this.run(record.toolName!, record.userId);
    }
  }

  private async run(toolName: string, owner: string | undefined) {
    try {
      const userId = await this.home.resolveUserId(owner);
      const result = await this.registry.invoke(toolName, {}, this.registry.context(userId, "schedule"));
      this.logger.log(`Scheduled ${toolName}: ${(result as { message?: string })?.message ?? "done"}`);
    } catch (err) {
      this.logger.error(`Scheduled ${toolName} failed: ${(err as Error).message}`);
    }
  }
}
