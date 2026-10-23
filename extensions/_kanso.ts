import type { z } from "zod";

interface DeviceBase {
  id: string;
  name: string;
  room: string;
  status: "online" | "offline" | "error";
  hubId?: string;
}
export interface Light extends DeviceBase {
  type: "light";
  isOn: boolean;
}
export interface Fan extends DeviceBase {
  type: "fan";
  isOn: boolean;
}
export interface Speaker extends DeviceBase {
  type: "speaker";
  isOn: boolean;
}
export interface Lock extends DeviceBase {
  type: "lock";
  locked: boolean;
}
export interface Thermostat extends DeviceBase {
  type: "thermostat";
  temperature: number;
}
export interface Hub extends DeviceBase {
  type: "hub";
}

/** Narrow on `type` to reach the fields that exist for that kind of device. */
export type Device = Light | Fan | Speaker | Lock | Thermostat | Hub;
export type DeviceType = Device["type"];
export type DeviceOf<T extends DeviceType> = Extract<Device, { type: T }>;

export interface ActionResult<D extends Device = Device> {
  ok: boolean;
  message: string;
  device?: D;
}

export interface Timer {
  id: string;
  label: string;
  durationMs: number;
  endsAt: string;
}

export interface HomeApi {
  listDevices(): Promise<Device[]>;
  /** Devices of one kind, so `devices("lock")` is typed as `Lock[]`. */
  devices<T extends DeviceType>(type: T): Promise<DeviceOf<T>[]>;
  /** The device whose name is closest to what was said, or undefined. */
  find(name: string): Promise<Device | undefined>;
  status(name: string): Promise<ActionResult>;
  setPower(name: string, on: boolean): Promise<ActionResult<Light | Fan | Speaker>>;
  setLock(name: string, locked: boolean): Promise<ActionResult<Lock>>;
  setTemperature(fahrenheit: number): Promise<ActionResult<Thermostat>>;
  createTimer(durationMs: number, label?: string): Timer;
  notify(message: string): void;
  now(): Date;
}

export interface ToolContext {
  userId: string;
  source: "local" | "mcp" | "pal" | "schedule";
  home: HomeApi;
  log: (message: string) => void;
}

export interface ToolSchedule {
  /** Runs the tool every day at this local time, written as 24-hour "HH:MM", for example "20:40". */
  daily: string;
}

export interface ToolDefinition<S extends z.ZodObject<z.ZodRawShape>> {
  name: string;
  description: string;
  inputSchema: S;
  /** Set this when the user asks for the automation to happen at a time. Kanso then runs it on its own with the default input. */
  schedule?: ToolSchedule;
  execute: (input: z.infer<S>, ctx: ToolContext) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export function defineTool<S extends z.ZodObject<z.ZodRawShape>>(definition: ToolDefinition<S>): ToolDefinition<S> {
  return definition;
}
