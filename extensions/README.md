# Extensions

Every `.ts` file in this folder is a Kanso tool. The backend watches the folder, validates each file with Zod, and registers it in the MCP tool registry without a restart. Files starting with `_` are ignored, which is why the shared types live in `_kanso.ts`.

```ts
import { z } from "zod";
import { defineTool } from "./_kanso.ts";

export default defineTool({
  name: "front_door_check",
  description: "Reports whether the front door is locked.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const status = await ctx.home.status("front door");
    return { ok: status.ok, message: status.message };
  },
});
```

`defineTool` types `input` from the schema and `ctx` as `ToolContext`. `ctx.home` exposes `listDevices()`, `status(name)`, `setPower(name, on)`, `setLock(name, locked)`, `setTemperature(f)`, `createTimer(ms, label?)`, `notify(message)` and `now()`. Return an object with a short `message`; the PAL speaks it.

Add `schedule: { daily: "20:40" }` to run a tool on its own every day at that local 24-hour time. Scheduled runs use the default input, so give every input field a default, and call `ctx.home.notify(message)` when something needs attention: the web app shows it, and so does the system, when alerts are turned on.

Node 25 runs these files with native type stripping, so only erasable TypeScript syntax works: no enums, namespaces, parameter properties or decorators, and relative imports need the `.ts` extension. `tsconfig.json` here lets your editor type-check the folder.
