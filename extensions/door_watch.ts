import { z } from "zod";
import { defineTool } from "./_kanso.ts";

// Generated locally from: "Every day at 8:40 PM, check whether all doors are locked and notify the user if any door is unlocked."
export default defineTool({
  name: "door_watch",
  description: "Checks every door lock and lets you know if one is unlocked.",
  inputSchema: z.object({}),
  schedule: { daily: "20:40" },
  async execute(_input, ctx) {
    try {
      const locks = await ctx.home.devices("lock");
      if (locks.length === 0) return { ok: false, message: "I could not find any door locks." };
      const unlocked = locks.filter((d) => d?.type === "lock" && !d.locked).map((d) => d!.name);
      if (unlocked.length === 0) return { ok: true, unlocked, message: "Every door is locked." };
      const message = unlocked.join(" and ") + (unlocked.length === 1 ? " is" : " are") + " unlocked.";
      ctx.home.notify(message);
      return { ok: true, unlocked, message };
    } catch (err) {
      return { ok: false, message: "Check failed: " + (err as Error).message };
    }
  },
});
