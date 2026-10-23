import type { z } from "zod";
import type { DeviceView } from "@/platform/events/domain-events";

export interface ActionResult {
  ok: boolean;
  message: string;
  device?: DeviceView;
}

/** The capabilities an extension receives. Kept small so generated tools stay simple. */
export interface HomeApi {
  listDevices(): Promise<DeviceView[]>;
  devices(type: DeviceView["type"]): Promise<DeviceView[]>;
  find(query: string): Promise<DeviceView | undefined>;
  status(query: string): Promise<ActionResult>;
  setPower(query: string, on: boolean): Promise<ActionResult>;
  setLock(query: string, locked: boolean): Promise<ActionResult>;
  setTemperature(value: number): Promise<ActionResult>;
  createTimer(durationMs: number, label?: string): unknown;
  notify(message: string): void;
  now(): Date;
}

export type ToolSource = "local" | "mcp" | "pal" | "schedule";

export interface ToolContext {
  userId: string;
  source: ToolSource;
  home: HomeApi;
  log: (message: string) => void;
}

export interface KansoTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown> | unknown;
  source: "core" | "extension";
  filePath?: string;
  registeredAt: string;
}

export type ToolDefinition = Omit<KansoTool, "registeredAt">;
