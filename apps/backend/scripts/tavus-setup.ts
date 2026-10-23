/**
 * Creates or updates the Kanso PAL, attaches Magic Canvas, and, when PUBLIC_URL
 * is a public https URL, registers this backend as the PAL's MCP connector.
 *
 *   PUBLIC_URL=https://your-backend pnpm tavus:setup
 *
 * Re-run after the public URL changes. With TAVUS_CONNECTOR_ID set, the existing connector is repointed instead of a new one being created.
 * The connector signs in to Kanso with OAuth, so the script ends with a link to approve it.
 */
const API = "https://tavusapi.com/v2";

const key = process.env.TAVUS_API_KEY;

const publicUrl = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");

if (!key) throw new Error("TAVUS_API_KEY is required");

const hasPublicUrl = /^https:\/\//.test(publicUrl);

const SYSTEM_PROMPT = `
You are Kanso, a calm smart home assistant on a video call. Keep every reply to one short sentence, and skip filler like "Sure, I can help with that".
You cannot see or change the home yourself. For every request about devices, lights, locks, the thermostat, timers, the hub, homes, or custom automations, call delegate_background_task straight away with the user's request in plain words, for example "turn on the bedroom lamp".
Never say something is done before the task's outcome comes back. While it runs, say a few words such as "On it." When the outcome arrives, repeat it in one sentence.
If the outcome says a hub is offline, offer to restart it, and when the user agrees, delegate "restart the hub".
If a request is unclear, ask one short either-or question.
`;

const MCP_PROMPT = `
You act on the user's home through the Kanso tools. Use control_device to turn devices on or off and to lock or unlock, device_status to check a device, set_temperature for the thermostat, set_timer for timers, restart_hub when a hub is offline, and create_tool when the user wants a new automation.
Pass the device name the user said. Finish with one plain sentence describing what changed, using the tool's message when it has one.
`;

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": key! },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text}`);

  return text ? JSON.parse(text) : {};
}

async function main() {
  let connectorId = process.env.TAVUS_CONNECTOR_ID ?? null;
  let authorizeUrl: string | null = null;
  if (hasPublicUrl) {
    const connectorBody = { name: `Kanso MCP (${new URL(publicUrl).host})`, server_url: `${publicUrl}/mcp` };
    if (connectorId) {
      console.log("1/3 Pointing MCP connector", connectorId, "at", connectorBody.server_url);
      await call(`/connectors/${connectorId}`, "PATCH", connectorBody);
      const { authorize_url } = await call(`/connectors/${connectorId}/oauth/reconnect`, "POST");
      authorizeUrl = authorize_url;
    } else {
      console.log("1/3 Registering MCP connector:", connectorBody.server_url);
      const connector = await call("/connectors", "POST", { ...connectorBody, auth_config: { type: "oauth2" } });
      connectorId = connector.connector_id;
      authorizeUrl = connector.authorize_url;
      console.log("   connector_id:", connectorId);
    }
  } else {
    console.log("1/3 Skipping MCP connector: PUBLIC_URL is not a public https URL. The PAL will talk but cannot call tools until you re-run with one.");
  }

  let palId = process.env.TAVUS_PAL_ID;
  if (palId) {
    console.log("2/3 Updating existing PAL", palId);

    await call(`/pals/${palId}`, "PATCH", [
      { op: "replace", path: "/system_prompt", value: SYSTEM_PROMPT },
      ...(connectorId
        ? [
            { op: "add", path: "/layers/mcp/connectors", value: [connectorId] },
            { op: "add", path: "/layers/mcp/prompt", value: MCP_PROMPT },
          ]
        : []),
    ]);
  } else {
    console.log("2/3 Creating PAL");
    const pal = await call("/pals", "POST", {
      pal_name: "Kanso",
      system_prompt: SYSTEM_PROMPT,
      context: "Kanso is a local-first assistant. Tools run on the user's own machine. Replies are one sentence.",
      pipeline_mode: "full",
      ...(process.env.TAVUS_FACE_ID ? { default_face_id: process.env.TAVUS_FACE_ID } : {}),
      layers: {
        ...(connectorId ? { mcp: { connectors: [connectorId], prompt: MCP_PROMPT } } : {}),
        conversational_flow: { turn_taking_patience: "medium", pal_interruptibility: "high" },
      },
    });
    palId = pal.pal_id;
    console.log("   pal_id:", palId);
  }

  console.log("3/3 Attaching Magic Canvas skill");
  await call(`/pals/${palId}/skills/magic_canvas`, "PUT", { config: {} });

  console.log("\nDone. Add this to apps/backend/.env:\n");
  console.log(`TAVUS_PAL_ID=${palId}`);
  if (connectorId) console.log(`TAVUS_CONNECTOR_ID=${connectorId}`);
  if (authorizeUrl) console.log(`\nOpen this link to let Tavus use Kanso, then enter the link code from Kanso's Link a device screen:\n${authorizeUrl}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
