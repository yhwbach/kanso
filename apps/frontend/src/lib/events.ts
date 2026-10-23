import { z } from "zod";

const device = z.object({
  id: z.string(),
  name: z.string(),
  room: z.string(),
  type: z.enum(["light", "lock", "thermostat", "fan", "hub", "speaker"]),
  status: z.enum(["online", "offline", "error"]),
  isOn: z.boolean(),
  locked: z.boolean(),
  temperature: z.number().optional(),
  hubId: z.string().optional(),
  restarting: z.boolean().optional(),
});

const timer = z.object({ id: z.string(), label: z.string(), durationMs: z.number(), endsAt: z.string(), createdAt: z.string() });

const event = <T extends string, P extends z.ZodType>(type: T, payload: P) => z.object({ type: z.literal(type), payload, at: z.string() });

const realtimeEvent = z.discriminatedUnion("type", [
  event("device.updated", device),
  event("device.unreachable", z.object({ device, hub: device, diagnosis: z.string() })),
  event("timer.created", timer),
  event("timer.finished", timer),
  event("timer.cancelled", timer),
  event("tool.registered", z.object({ name: z.string() })),
  event("tool.unregistered", z.object({ name: z.string() })),
  event(
    "tool.scaffolded",
    z.object({
      intent: z.string(),
      engine: z.string(),
      tool: z.object({ name: z.string() }),
      fileName: z.string(),
      code: z.string(),
      daily: z.string().optional(),
    }),
  ),
  event("tool.invalid", z.object({ fileName: z.string(), error: z.string() })),
  event("tool.invoked", z.object({ tool: z.string() })),
  event("notification", z.object({ message: z.string() })),
  event("command.handled", z.object({ source: z.string(), reply: z.string() })),
  event("tavus.webhook", z.object({ eventType: z.string() })),
]);

export type RealtimeEvent = z.infer<typeof realtimeEvent>;

export const REALTIME_EVENT_TYPES = realtimeEvent.options.map((o) => o.shape.type.value);

/** Returns the event when it matches a known shape. Unknown or malformed frames are dropped. */
export function parseRealtimeEvent(data: unknown): RealtimeEvent | null {
  const parsed = realtimeEvent.safeParse(data);
  return parsed.success ? parsed.data : null;
}
