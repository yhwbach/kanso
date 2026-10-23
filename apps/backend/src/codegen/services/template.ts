/** Reads "8:40 PM", "8pm" or "20:40" as a 24-hour "HH:MM" time. */
function readTime(text: string): string | undefined {
  const twelve = text.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/);
  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  let hour: number;
  let minute: number;
  if (twelve && Number(twelve[1]) <= 12) {
    hour = (Number(twelve[1]) % 12) + (twelve[3] === "pm" ? 12 : 0);
    minute = Number(twelve[2] ?? 0);
  } else if (twentyFour) {
    hour = Number(twentyFour[1]);
    minute = Number(twentyFour[2]);
  } else {
    return undefined;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Offline fallback used when Bedrock is not configured or fails. A time in the request becomes a daily schedule. */
export function templateTool(intent: string): string {
  const lower = intent.toLowerCase();
  const quoted = intent.replace(/"/g, '\\"');
  const daily = readTime(lower);
  const deviceMatch = lower.match(/(front door|back door|doors?|garage|living room lights?|kitchen lights?|bedroom (?:lamp|lights?)|backyard lights?|thermostat|ceiling fan|fan|lights?)/);
  const device = deviceMatch ? deviceMatch[1].replace(/^doors$/, "door") : "front door";
  const label = device.charAt(0).toUpperCase() + device.slice(1);
  const power = /\b(?:turn|switch|shut)\b[^.,]*?\boff\b/.test(lower) ? "off" : /\b(?:turn|switch)\b[^.,]*?\bon\b/.test(lower) ? "on" : undefined;
  const alerts = /alert|notify|warn|tell me|remind|let me know/.test(lower) || (daily !== undefined && !power);
  const slug = device.replace(/[^a-z0-9]+/g, "_");
  const name = power ? `${slug}_${power}` : `${slug.replace(/s$/, "")}_${alerts ? "watch" : "check"}`;
  const schedule = daily ? `\n  schedule: { daily: "${daily}" },` : "";

  if (/lock|door/.test(device)) {
    const everyLock = device === "door";
    return `import { z } from "zod";
import { defineTool } from "./_kanso.ts";

// Generated locally from: "${quoted}"
export default defineTool({
  name: "${name}",
  description: "Checks ${everyLock ? "every door lock" : `the ${device} lock`}${alerts ? ` and lets you know if ${everyLock ? "one" : "it"} is unlocked` : ""}.",
  inputSchema: z.object({}),${schedule}
  async execute(_input, ctx) {
    try {
      const locks = ${everyLock ? 'await ctx.home.devices("lock")' : `[await ctx.home.find("${device}")].filter((d) => d?.type === "lock")`};
      if (locks.length === 0) return { ok: false, message: "I could not find ${everyLock ? "any door locks" : `the ${device}`}." };
      const unlocked = locks.filter((d) => d?.type === "lock" && !d.locked).map((d) => d!.name);
      if (unlocked.length === 0) return { ok: true, unlocked, message: "${everyLock ? "Every door is locked." : `${label} is locked.`}" };
      const message = new Intl.ListFormat("en").format(unlocked) + (unlocked.length === 1 ? " is" : " are") + " unlocked.";
      ${alerts ? "ctx.home.notify(message);" : ""}
      return { ok: true, unlocked, message };
    } catch (err) {
      return { ok: false, message: "Check failed: " + (err as Error).message };
    }
  },
});
`;
  }

  const everyLight = device === "lights" || device === "light" && /\b(?:all|every)\b/.test(lower);
  const what = everyLight ? "every light" : `the ${device}`;
  const targets = everyLight
    ? 'await ctx.home.devices("light")'
    : `[await ctx.home.find("${device}")].filter((d) => d !== undefined && "isOn" in d)`;
  const found = `if (targets.length === 0) return { ok: false, message: "I could not find ${everyLight ? "any lights" : `the ${device}`}." };`;

  if (power) {
    const on = power === "on";
    return `import { z } from "zod";
import { defineTool } from "./_kanso.ts";

// Generated locally from: "${quoted}"
export default defineTool({
  name: "${name}",
  description: "Turns ${power} ${what}${alerts ? " and lets you know" : ""}.",
  inputSchema: z.object({}),${schedule}
  async execute(_input, ctx) {
    try {
      const targets = ${targets};
      ${found}
      const changed: string[] = [];
      for (const d of targets) {
        if (!d || !("isOn" in d) || d.isOn === ${on}) continue;
        const r = await ctx.home.setPower(d.name, ${on});
        if (r.ok) changed.push(d.name);
      }
      const message = changed.length
        ? "Turned ${power} " + new Intl.ListFormat("en").format(changed) + "."
        : "${everyLight ? `Every light was already ${power}.` : `${label} was already ${power}.`}";
      ${alerts ? "ctx.home.notify(message);" : ""}
      return { ok: true, changed, message };
    } catch (err) {
      return { ok: false, message: "That didn't work: " + (err as Error).message };
    }
  },
});
`;
  }

  return `import { z } from "zod";
import { defineTool } from "./_kanso.ts";

// Generated locally from: "${quoted}"
export default defineTool({
  name: "${name}",
  description: "Checks ${what}${alerts ? " and lets you know what is on" : " and reports what is on"}.",
  inputSchema: z.object({}),${schedule}
  async execute(_input, ctx) {
    try {
      const targets = ${targets};
      ${found}
      const lit = targets.filter((d) => d && "isOn" in d && d.isOn).map((d) => d!.name);
      if (lit.length === 0) return { ok: true, on: lit, message: "${everyLight ? "Every light is off." : `${label} is off.`}" };
      const message = new Intl.ListFormat("en").format(lit) + (lit.length === 1 ? " is" : " are") + " on.";
      ${alerts ? "ctx.home.notify(message);" : ""}
      return { ok: true, on: lit, message };
    } catch (err) {
      return { ok: false, message: "Check failed: " + (err as Error).message };
    }
  },
});
`;
}
