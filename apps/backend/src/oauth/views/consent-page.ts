import { BRAND_MARK } from "@/oauth/views/brand-mark";

const ABILITIES = ["Turn lights and devices on or off", "Lock doors and check if they are locked", "Set and cancel timers", "Run the automations you have made"];

const STYLES = `
:root{color-scheme:light;--bg:#f6f6f6;--surface:#fff;--line:#dcdcdc;--line2:#bdbdbd;--ink:#0b0b0b;--ink2:#4f4f4f;--ink3:#8a8a8a;--accent:#d71921;--accentInk:#fff}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#0b0b0b;--surface:#161616;--line:#262626;--line2:#3a3a3a;--ink:#f2f2f2;--ink2:#a5a5a5;--ink3:#6b6b6b}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--line);border-radius:2px}
.head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px dashed var(--line2)}
.brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink)}
.label{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.muted{color:var(--ink3)}
.body{padding:28px 20px 24px}
h1{font-family:Doto,ui-monospace,monospace;font-weight:900;font-size:34px;line-height:1.05;letter-spacing:.01em;text-transform:uppercase;margin:0 0 14px}
p{margin:0 0 22px;color:var(--ink2);line-height:1.55;font-size:15px}
strong{color:var(--ink);font-weight:600}
ul{list-style:none;margin:0 0 24px;padding:0;border-top:1px dashed var(--line2)}
li{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px dashed var(--line2);font-size:14px}
li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent);flex:none}
.allow{display:block;width:100%;text-align:center;background:var(--accent);color:var(--accentInk);border:0;cursor:pointer;padding:14px;border-radius:2px}
.code{display:block;margin:0 0 8px}
.code input{display:block;width:100%;margin-top:8px;padding:12px 14px;border:1px solid var(--line2);border-radius:2px;background:var(--bg);color:var(--ink);font-family:Doto,ui-monospace,monospace;font-weight:900;font-size:30px;letter-spacing:.3em;text-align:center}
.code input:focus{outline:2px solid var(--ink);outline-offset:1px}
.hint{font-size:13px;color:var(--ink3);margin:0 0 18px}
.error{font-size:13px;color:var(--accent);margin:0 0 18px}
.allow:hover{filter:brightness(1.08)}
.allow:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.foot{padding:14px 20px;border-top:1px dashed var(--line2);font-size:13px;color:var(--ink3);line-height:1.5}
`;

export function consentPage(opts: { clientName: string | undefined; params: Record<string, string>; error?: string }) {
  const requester = opts.clientName ? `<strong>${escapeHtml(opts.clientName)}</strong> would` : "An app would";
  const hidden = Object.entries(opts.params)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join("");
  return page(
    "Access request",
    `<h1>Allow access</h1>
<p>${requester} like to help around your home. It will be able to:</p>
<ul>${ABILITIES.map((a) => `<li>${a}</li>`).join("")}</ul>
<form method="post" action="/oauth/approve">${hidden}
<label class="code"><span class="label muted">Link code</span><input name="link_code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="7" required autofocus></label>
${opts.error ? `<p class="error" role="alert">${escapeHtml(opts.error)}</p>` : `<p class="hint">Open Kanso at home, choose Link a device, and enter the code it shows.</p>`}
<button class="allow label" type="submit">Allow</button>
</form>`,
  );
}

export function messagePage(title: string, text: string) {
  return page("Kanso", `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>`);
}

function page(tag: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kanso</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Doto:wght@900&family=Inter:wght@400;600&family=JetBrains+Mono:wght@600&display=swap">
<style>${STYLES}</style></head><body>
<main class="card">
<div class="head"><span class="brand">${BRAND_MARK}<span class="label">Kanso</span></span><span class="label muted">${escapeHtml(tag)}</span></div>
<div class="body">${body}</div>
<div class="foot">Everything still runs on your own computer, so nothing you say leaves the house.</div>
</main></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
