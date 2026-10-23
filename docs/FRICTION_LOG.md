# Kanso Friction Log

Kanso is a local-first smart home assistant. It runs as an MCP server on your own computer, it talks to people through a Tavus PAL (a video face) and Alexa+, and it uses Desert Ant's on-device models to hide personal details before anything leaves the house. This log covers the places where building it was harder than it should have been, in the order we hit them.

**Severity scale**

| Rating | Meaning |
|---|---|
| Critical | Blocks the core experience, with no obvious way forward |
| High | Breaks a main feature until you find a non-obvious workaround |
| Medium | Costs real time or needs custom code, but the path is findable |
| Low | Annoying or confusing, quick to work around |

**Summary**

| # | Area | Issue | Severity |
|---|---|---|---|
| 1 | Tavus PAL + MCP | The face promised actions but never called the tools | Critical |
| 2 | Tavus MCP connector | The face said it "can't reach the connected service" with no detail | High |
| 3 | Tunnels | The free ngrok account was banned mid-build | High |
| 4 | Tavus connector API | The connector URL has to be updated, and OAuth re-approved, on every tunnel restart | Medium |
| 5 | Tavus API | PATCH bodies differ between PALs and connectors | Low |
| 6 | Tavus CVI components | The face was cropped, the camera started on, and the controls were hard to restyle | Medium |
| 7 | Desert Ant redact | Device names and small numbers were treated as personal details | High |
| 8 | Browser + Vite | The microphone failed on phones and other devices on the home network | Medium |

---

## 1. The face agreed to act but never called the tools

- **Area:** Tavus PAL with an MCP connector
- **Severity:** Critical
- **Task attempted:** Ask the Kanso face, by voice, to turn on the bedroom lamp, and have it call Kanso's `control_device` tool.
- **Steps taken:**
  1. Created a PAL with a system prompt describing Kanso as a smart home assistant.
  2. Registered Kanso's `/mcp` endpoint as a connector and attached it to the PAL under `layers.mcp.connectors`.
  3. Confirmed through `GET /v2/connectors/{id}/preview` that Tavus could see all of Kanso's tools.
  4. Started a call and said "turn on my bedroom lamp".
- **Expected:** The PAL calls `control_device` and the lamp turns on.
- **Actual:** The face replied "Sure, I'll turn that on", but no request ever reached Kanso. Our server logs stayed empty, and the lamp stayed off. The face recognized the lamp by name, so it clearly knew about the home, which made the failure confusing.
- **Workaround:** We found that tools are used through a background agent, which the PAL starts by calling `delegate_background_task`. We rewrote the system prompt to say: "For every request about devices... call `delegate_background_task` straight away with the user's request in plain words. Never say something is done before the task's outcome comes back." We also set `layers.mcp.prompt` to tell the background agent which tool to use for each kind of request. After that, tool calls arrived reliably.
- **Actionable suggestion:**
  - Document `delegate_background_task` on the MCP connector page, with a recommended system prompt snippet.
  - Show a warning in the dashboard when a PAL has connectors attached but its prompt never leads to a delegation.
  - Add a per-conversation log of which tools the background agent called and what they returned. Without one, the only way to debug this was our own server logs.

## 2. "I can't reach the connected service"

- **Area:** Tavus MCP connector
- **Severity:** High
- **Task attempted:** Let the face call Kanso's tools while Kanso runs on a laptop.
- **Steps taken:** Registered the connector with Kanso's local URL, then asked the face a home question during a call.
- **Expected:** Either the call works, or the face reports a clear connection error.
- **Actual:** Each request got a spoken "I can't get to the connected service right now." Nothing in the reply said why it failed: unreachable host, TLS problem, authentication, or timeout.
- **Workaround:** We worked out that Tavus must reach the server over public HTTPS, so localhost can never work. We exposed Kanso through a tunnel (see #3 and #4).
- **Actionable suggestion:**
  - Validate `server_url` when a connector is created or updated. Reject `localhost`, private addresses and plain `http`, and say why.
  - Add a "Test connection" button and endpoint that reports the actual failure, such as DNS, TLS, 401 or timeout.
  - Give the PAL a short machine-readable reason it can pass on, for example "the tool server didn't answer in time".

## 3. The tunnel provider banned the account mid-build

- **Area:** Exposing a local server (ngrok)
- **Severity:** High
- **Task attempted:** Give Tavus a public HTTPS URL for a server on a laptop.
- **Steps taken:** Used a free ngrok account to tunnel port 3000.
- **Expected:** A stable tunnel for the length of the hackathon.
- **Actual:** The account was banned partway through. Every request through the tunnel failed, which looked exactly like issue #2.
- **Workaround:** Switched to a Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:3000`). It needs no account, but its URL changes on every restart.
- **Actionable suggestion:** For Tavus, add a short "Local development" guide that recommends a tunnel and explains the URL-change problem. Even better, offer a Tavus-hosted relay for connectors during development, so builders don't depend on third-party tunnels.

## 4. Every tunnel restart breaks the connector

- **Area:** Tavus connector API and OAuth
- **Severity:** Medium
- **Task attempted:** Keep the face working across laptop restarts, with Kanso requiring sign-in on `/mcp`.
- **Steps taken:**
  1. Restarted the Cloudflare quick tunnel, which gave a new URL.
  2. Updated the connector with `PATCH /v2/connectors/{id}` and the new `server_url`.
  3. Switched the connector to `auth_config: { type: "oauth2" }` so Tavus signs in through Kanso's OAuth 2.1 server, which uses PKCE and dynamic client registration.
- **Expected:** One update and the face works again.
- **Actual:** OAuth worked well once we found the steps, and dynamic client registration and token refresh behaved correctly. But a new URL means a new issuer, so the link has to be approved again each time. That step lives in `POST /v2/connectors/{id}/oauth/reconnect`, which returns a fresh `authorize_url`, and we only found it by reading the OpenAPI spec.
- **Workaround:** Our setup script (`pnpm tavus:setup`) repoints the existing connector, calls `oauth/reconnect` and prints the approval link. Kanso's consent page then asks for a six-digit code shown only on the home network.
- **Actionable suggestion:**
  - Document the reconnect flow next to the OAuth connector guide.
  - Let `PATCH /connectors/{id}` take an option that starts a reconnect and returns `authorize_url` in the same response.
  - Show `oauth_status` in the dashboard with a "Reconnect" button.

## 5. PATCH means two different things

- **Area:** Tavus REST API
- **Severity:** Low
- **Task attempted:** Update a PAL and its connector from one script.
- **Steps taken:** Called `PATCH /v2/pals/{id}` and `PATCH /v2/connectors/{id}` from the same setup script.
- **Expected:** The same body style for both.
- **Actual:** PALs expect a JSON Patch array (`[{ "op": "replace", "path": "/system_prompt", "value": "..." }]`). Connectors expect a plain object. Nothing in the endpoint names makes this obvious, so one script that updates both needs two body formats.
- **Workaround:** We wrote both shapes into the setup script.
- **Actionable suggestion:** Accept both shapes on both endpoints, using `Content-Type: application/json-patch+json` for JSON Patch. If that isn't possible, have the validation error say which shape the endpoint expects.

## 6. The video components needed patching to fit the app

- **Area:** Tavus CVI React components (Daily-based)
- **Severity:** Medium
- **Task attempted:** Embed the face in Kanso's own visual style.
- **Steps taken:** Added the CVI components and rendered a conversation inside a card.
- **Expected:** The face fills the card, the user's camera starts off, and the controls can be themed.
- **Actual:**
  - **Cropped face:** the conversation container forces an aspect ratio, so the face's head was cut off at the top in a wide card.
  - **Camera on by default:** the user's camera turned on as soon as the call joined. There was no prop to change that.
  - **Hard to restyle:** the microphone and camera pickers use CSS modules with native-looking menus that are hard to restyle without rewriting them.
- **Workaround:**
  - Set the container to fill its parent and moved the video's focus point to `object-position: center 30%`.
  - Added `startVideoOff: true` to the `daily.join()` call inside the generated hook.
  - Rewrote the device pickers using `useDevices()` from `@daily-co/daily-react`.
- **Actionable suggestion:**
  - Expose `startVideoOff` and `startAudioOff` as props on the conversation component.
  - Make the container's sizing a prop, choosing between fitting the parent or a fixed aspect ratio.
  - Ship the device pickers as headless hooks with an optional styled default, so apps can render their own menus.

## 7. Redaction hid the words commands depend on

- **Area:** Desert Ant `redact` (on-device PII redaction)
- **Severity:** High
- **Task attempted:** Hide personal details in every spoken command before it reaches any cloud service, while still understanding the command.
- **Steps taken:** Ran each command through `redact` and sent the redacted text to Kanso's intent router.
- **Expected:** Phone numbers, emails and people's names are replaced. Device names and settings stay as they are.
- **Actual:** Commands like "The Backyard Hub is currently offline, put it online" and "set it to 70 degrees" came back with the device name and the number replaced by placeholders. The router then couldn't tell what to act on, and replied "Sorry, I didn't catch that."
- **Workaround:** Every item `redact` returns includes `original`, `start` and `end`. We rebuild the text ourselves from those offsets, skipping any item whose original text matches a known device or room name, and any one-to-three digit number.
- **Actionable suggestion:**
  - Add an allowlist option, for example `redact(text, { keep: ["Backyard Hub", "Bedroom Lamp"] })`.
  - Let callers choose entity types, for example `{ only: ["PHONE", "EMAIL", "PERSON"] }`.
  - Return a confidence score per item, so callers can drop weak matches such as a bare "70".

## 8. The microphone didn't work on other devices at home

- **Area:** Browser security rules with the Vite dev server
- **Severity:** Medium
- **Task attempted:** Use Kanso's voice input from a phone on the same wifi.
- **Steps taken:** Opened `http://<computer's IP>:5173` on the phone and pressed the mic button.
- **Expected:** The browser asks for microphone access.
- **Actual:** The app showed "Cannot read properties of undefined (reading 'getUserMedia')". Browsers only expose `navigator.mediaDevices` on secure pages, and plain `http` on a network address doesn't count, though `localhost` does.
- **Workaround:**
  - Served the dev server over HTTPS with `@vitejs/plugin-basic-ssl`.
  - Proxied `/api` through Vite so the page never calls the plain-HTTP backend directly.
  - Showed a clear message whenever the page isn't secure.
- **Actionable suggestion:** Browsers could replace `undefined` with an error naming the cause, such as "Microphone access needs a secure page". Voice SDKs, including Desert Ant's speech model, could check `window.isSecureContext` up front and say so.

---

## What worked well

- **Tavus connector preview:** `GET /v2/connectors/{id}/preview` listing the server's tools was the fastest way to confirm Tavus could see Kanso.
- **Tavus OAuth support:** dynamic client registration and refresh tokens worked against a self-hosted OAuth 2.1 server with no special cases.
- **Desert Ant offsets:** returning offsets with every redacted item made the issue #7 workaround possible.
- **Node 25 type stripping:** user automations run as plain `.ts` files with no build step.
