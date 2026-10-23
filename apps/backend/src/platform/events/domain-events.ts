export const DOMAIN_EVENTS = {
  DEVICE_UPDATED: "home.device.updated",
  DEVICE_UNREACHABLE: "home.device.unreachable",
  TIMER_CREATED: "home.timer.created",
  TIMER_FINISHED: "home.timer.finished",
  TIMER_CANCELLED: "home.timer.cancelled",
  COMMAND_HANDLED: "commands.command.handled",
  TOOL_REGISTERED: "tools.tool.registered",
  TOOL_UNREGISTERED: "tools.tool.unregistered",
  TOOL_SCAFFOLDED: "tools.tool.scaffolded",
  TOOL_INVALID: "tools.tool.invalid",
  TOOL_INVOKED: "tools.tool.invoked",
  NOTIFICATION: "tools.notification",
  TAVUS_WEBHOOK: "tavus.webhook.received",
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface DeviceView {
  id: string;
  name: string;
  room: string;
  type: "light" | "lock" | "thermostat" | "fan" | "hub" | "speaker";
  status: "online" | "offline" | "error";
  isOn: boolean;
  locked: boolean;
  temperature?: number;
  hubId?: string;
  restarting?: boolean;
}

export interface DeviceUpdatedEvent {
  userId: string;
  device: DeviceView;
}

export interface DeviceUnreachableEvent {
  userId: string;
  device: DeviceView;
  hub: DeviceView;
  diagnosis: string;
  suggestedAction: "restart_hub";
}

export interface TimerEvent {
  userId: string;
  timer: { id: string; label: string; durationMs: number; endsAt: string; createdAt: string };
}

export interface CommandHandledEvent {
  userId: string;
  logId: string;
  transcript: string;
  sanitized: string;
  piiDetected: boolean;
  reply: string;
  actions: Record<string, unknown>[];
  latency: Record<string, number>;
  cloudEgress: boolean;
  source: "local" | "pal";
  timestamp: string;
}

export interface ToolEvent {
  name: string;
  source: "core" | "extension";
  description?: string;
  fileName?: string;
}

export interface ToolScaffoldedEvent {
  userId: string;
  intent: string;
  engine: "bedrock" | "local-template";
  tool: ToolEvent;
  fileName: string;
  code: string;
  daily?: string;
}

export interface ToolInvalidEvent {
  fileName: string;
  error: string;
}

export interface ToolInvokedEvent {
  userId: string;
  tool: string;
  source: "local" | "mcp" | "pal" | "schedule";
  args: Record<string, unknown>;
  result: unknown;
  ms: number;
}

export interface NotificationEvent {
  userId: string;
  message: string;
}

export interface TavusWebhookEvent {
  eventType: string;
  payload: Record<string, unknown>;
}
