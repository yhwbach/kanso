import { z } from "zod";
import { defineTool } from "./_kanso.ts";

// Rename this file without the leading underscore to load it.
export default defineTool({
  name: "front_door_check",
  description: "Reports whether the front door is locked and warns when it is unlocked late at night.",
  inputSchema: z.object({
    afterHour: z.number().min(0).max(23).default(22).describe("Hour of day (24h) after which an unlocked door is a problem"),
  }),
  async execute(input, ctx) {
    const door = await ctx.home.find("front door");
    if (!door || door.type !== "lock") return { ok: false, message: "I could not find the front door." };
    const late = ctx.home.now().getHours() >= input.afterHour;
    if (!door.locked && late) ctx.home.notify("The front door is unlocked and it is late.");
    return { ok: true, locked: door.locked, message: door.locked ? "Front door is locked." : "Front door is unlocked." };
  },
});
