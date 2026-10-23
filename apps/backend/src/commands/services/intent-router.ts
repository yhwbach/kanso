export type Intent =
  | { kind: "power"; target: string; on: boolean }
  | { kind: "lock"; target: string; locked: boolean }
  | { kind: "timer"; durationMs: number; label: string }
  | { kind: "cancel_timer" }
  | { kind: "temperature"; value: number }
  | { kind: "adjust_temperature"; delta: number }
  | { kind: "summary"; scope: "on" | "all" }
  | { kind: "status"; target: string }
  | { kind: "diagnose"; target: string }
  | { kind: "restart_hub"; target: string }
  | { kind: "scaffold"; description: string }
  | { kind: "list_tools" }
  | { kind: "run_tool"; name: string; args: Record<string, unknown> }
  | { kind: "unknown"; text: string };

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60, ninety: 90, half: 0.5,
};

const UNIT = /(seconds?|secs?|minutes?|mins?|hours?|hrs?)/.source;

const LEAD_IN = /^(?:(?:hi|hello|hey)(?: there)?|ok(?:ay)?|so|well|please|(?:can|could|would|will) you(?: please)?|i(?: want| need| would like|'d like) you to|go ahead and|kanso|alexa)\b[,\s]*/;
const TRAIL = /[,\s]+(?:please|for me|now|right now|thanks|thank you)$/;

const TEMPERATURE_QUESTION = /^(?:what(?:'s| is)|tell me|check)\s+(?:the\s+)?(?:current\s+|indoor\s+)?(?:temperature|temp)(?:\s+(?:in here|inside|at home|in the house|right now|now))*$|^what(?:'s| is)? the thermostat(?:\s+(?:set to|at|on))?$|^how (?:warm|hot|cold) is it(?:\s+(?:in here|inside|at home|in the house|right now))*$|^what temperature is it(?:\s+(?:in here|inside|at home|right now))*$/;
const ON_QUESTION = /^(?:what(?:'s| is)\s+(?:on|running)(?:\s+(?:at home|in the house|right now))*|(?:which|what)\s+(?:lights?|devices?)\s+(?:are|is)\s+(?:still\s+)?on|(?:is|are)\s+(?:anything|any lights?|any devices?)\s+(?:still\s+)?on|did i leave (?:anything|any lights?) on)$/;
const SUMMARY_QUESTION = /^(?:what(?:'s| is)\s+happening(?:\s+(?:at home|in the house|right now))*|how(?:'s| is)\s+(?:my|the)\s+(?:home|house|place)(?:\s+doing)?|(?:give me\s+)?(?:a\s+)?(?:home\s+)?(?:status|summary|update|rundown)(?:\s+(?:of|on)\s+(?:my|the)\s+(?:home|house))?|what(?:'s| is) the status of (?:my|the) (?:home|house))$/;
const PRONOUN = /^(?:it|them|that|this|those|these)$/;
const OBSERVATION = /^(?:the\s+|my\s+)?([a-z][a-z ]*?)\s+(?:is|are|seems?|looks?|keeps?)\s+(?:currently\s+|still\s+|now\s+|totally\s+|completely\s+)*(?:offline|down|broken|not working|disconnected|unreachable|not responding|stuck|dead)$/;

function stripPoliteness(clause: string): string {
  let c = clean(clause);
  for (let prev = ""; prev !== c; ) {
    prev = c;
    c = clean(c.replace(LEAD_IN, "").replace(TRAIL, ""));
  }
  return c;
}

export function parseIntents(input: string): Intent[] {
  const text = clean(input.toLowerCase());
  if (!text) return [];
  const intents: Intent[] = [];
  let lastPower: boolean | null = null;
  let subject: string | undefined;
  const resolve = (target: string) => {
    const resolved = PRONOUN.test(target) && subject ? subject : target;
    subject = resolved;
    return resolved;
  };

  for (const clause of splitClauses(text)) {
    const c = stripPoliteness(clause);
    if (!c) continue;
    let m: RegExpMatchArray | null;

    if ((m = c.match(OBSERVATION))) {
      subject = clean(m[1]);
      continue;
    } else if ((m = c.match(/^(?:put|bring|get|set)\s+(?:the\s+|my\s+)?(.+?)\s+(?:back\s+)?(online|on line|up|offline)$/)) || (m = c.match(/^(?:reconnect|wake up|wake)\s+(?:the\s+|my\s+)?(.+)$/))) {
      intents.push({ kind: "power", target: clean(m[1]), on: m[2] !== "offline" });
    } else if ((m = c.match(/^(?:create|build|make|write|add)\s+(?:me\s+)?(?:a|an)?\s*(?:new\s+)?(?:tool|automation|routine|skill|extension)\s+(?:that|which|to|called)?\s*(.+)$/))) {
      intents.push({ kind: "scaffold", description: clean(m[1]) });
    } else if (/^(?:what|which|list)\s+(?:my\s+)?(?:tools|automations|extensions)/.test(c)) {
      intents.push({ kind: "list_tools" });
    } else if ((m = c.match(/^(?:run|execute|test)\s+(?:the\s+)?(?:tool\s+)?([a-z0-9_ -]+?)(?:\s+tool)?(?:\s+with\s+(.+))?$/))) {
      const args: Record<string, unknown> = {};
      const kv = m[2]?.match(/([a-z_]+)\s+['"]?([^'"]+)['"]?/);
      if (kv) args[kv[1]] = kv[2];
      intents.push({ kind: "run_tool", name: m[1].trim().replace(/[\s-]+/g, "_"), args });
    } else if ((m = c.match(new RegExp(`^(?:set|start|create)\\s+(?:a\\s+|the\\s+)?(?:(.+?)\\s+)?timer\\s+(?:for|of)\\s+(?:(\\d+(?:\\.\\d+)?|[a-z]+)\\s*)?(?:and a half\\s*)?${UNIT}`)))) {
      intents.push(timer(m[2], m[3], m[1], c));
    } else if ((m = c.match(new RegExp(`^(?:set|start)\\s+(?:a\\s+)?(\\d+(?:\\.\\d+)?|[a-z]+)[\\s-]*${UNIT}\\s+timer(?:\\s+(?:for|called)\\s+(.+))?$`)))) {
      intents.push(timer(m[1], m[2], m[3], c));
    } else if (/^(?:cancel|stop|clear)\s+(?:the\s+|my\s+)?timers?$/.test(c)) {
      intents.push({ kind: "cancel_timer" });
    } else if (TEMPERATURE_QUESTION.test(c)) {
      intents.push({ kind: "status", target: "thermostat" });
    } else if ((m = c.match(/^(?:make it|turn it|turn the heat|turn the temperature)\s+(?:a\s+(?:bit|little)\s+|a\s+few\s+degrees\s+)?(warmer|hotter|cooler|colder|up|down)(?:\s+in here)?$|^(?:i'm|i am|it's|it is)\s+(?:a\s+(?:bit|little)\s+|too\s+|really\s+|so\s+)?(cold|hot|warm|chilly|freezing)(?:\s+in here)?$/))) {
      const word = m[1] ?? m[2];
      const warmer = /warmer|hotter|up/.test(word) || (m[2] !== undefined && /cold|chilly|freezing/.test(word));
      intents.push({ kind: "adjust_temperature", delta: warmer ? 2 : -2 });
    } else if (ON_QUESTION.test(c)) {
      intents.push({ kind: "summary", scope: "on" });
    } else if (SUMMARY_QUESTION.test(c)) {
      intents.push({ kind: "summary", scope: "all" });
    } else if ((m = c.match(/(?:set|change|turn)\s+(?:the\s+)?(?:thermostat|temperature|heat|ac|air conditioning)\s+(?:to|at)\s+(\d+)/)) || (m = c.match(/^(?:make it|set it to)\s+(\d+)\s*(?:degrees)?$/))) {
      intents.push({ kind: "temperature", value: Number(m[1]) });
    } else if ((m = c.match(/^(?:restart|reboot|reset)\s+(?:the\s+|my\s+)?(.+)$/))) {
      intents.push({ kind: "restart_hub", target: clean(m[1]) });
    } else if ((m = c.match(/^(?:why\s+(?:is|isn't|isnt|are|aren't)\s+(?:the\s+|my\s+)?(.+?)\s+(?:not\s+)?working|diagnose\s+(?:the\s+)?(.+)|what(?:'s| is) wrong with\s+(?:the\s+|my\s+)?(.+))$/))) {
      intents.push({ kind: "diagnose", target: clean(m[1] ?? m[2] ?? m[3]) });
    } else if ((m = c.match(/^(lock|unlock)\s+(?:the\s+|my\s+)?(.+)$/))) {
      intents.push({ kind: "lock", target: clean(m[2]), locked: m[1] === "lock" });
    } else if ((m = c.match(/^(?:is|are)\s+(?:the\s+|my\s+)?(.+?)\s+(?:locked|unlocked|on|off|open|closed|online|working)\??$/)) || (m = c.match(/^(?:check|what(?:'s| is) the (?:status|state) of)\s+(?:the\s+|my\s+)?(.+)$/))) {
      intents.push({ kind: "status", target: clean(m[1]) });
    } else if ((m = c.match(/^(?:turn|switch|power|flip)\s+(on|off)\s+(?:the\s+|my\s+)?(.+)$/))) {
      lastPower = m[1] === "on";
      intents.push({ kind: "power", target: clean(m[2]), on: lastPower });
    } else if ((m = c.match(/^(?:turn|switch|power|flip)\s+(?:the\s+|my\s+)?(.+?)\s+(on|off)$/))) {
      lastPower = m[2] === "on";
      intents.push({ kind: "power", target: clean(m[1]), on: lastPower });
    } else if ((m = c.match(/^(?:dim|kill|shut off|shut)\s+(?:the\s+|my\s+)?(.+)$/))) {
      intents.push({ kind: "power", target: clean(m[1]), on: false });
    } else if ((m = c.match(/^(?:lights?|lamp)\s+(on|off)$/))) {
      intents.push({ kind: "power", target: "lights", on: m[1] === "on" });
    } else if ((m = c.match(/^(?:the\s+|my\s+)?([a-z][a-z ]*?)\s+(on|off)$/))) {
      lastPower = m[2] === "on";
      intents.push({ kind: "power", target: clean(m[1]), on: lastPower });
    } else if (lastPower !== null && (m = c.match(/^(?:the\s+|my\s+)?([a-z ]+(?:lights?|lamp|fan))$/))) {
      intents.push({ kind: "power", target: clean(m[1]), on: lastPower });
    } else {
      intents.push({ kind: "unknown", text: c });
    }
    const latest = intents.at(-1);
    if (latest && "target" in latest) latest.target = resolve(latest.target);
  }
  const known = intents.filter((i) => i.kind !== "unknown");
  if (known.length) return known;
  if (subject) return [{ kind: "diagnose", target: subject }];
  return intents.length ? [{ kind: "unknown", text }] : [];
}

function timer(qtyRaw: string | undefined, unit: string, labelRaw: string | undefined, clause: string): Intent {
  let qty = qtyRaw ? Number(qtyRaw) : 1;
  if (Number.isNaN(qty)) qty = WORD_NUMBERS[qtyRaw!] ?? 1;
  if (clause.includes("and a half")) qty += 0.5;
  const mult = /^h/.test(unit) ? 3_600_000 : /^m/.test(unit) ? 60_000 : 1_000;
  const label = labelRaw ? labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1) : "Timer";
  return { kind: "timer", durationMs: Math.round(qty * mult), label };
}

function splitClauses(text: string): string[] {
  const sentences = text.split(/[.?!;]+\s*/).map(clean).filter(Boolean);
  return sentences.flatMap((sentence) => {
    const body = stripPoliteness(sentence);
    if (/^(create|build|make|write|add)\b/.test(body)) return [body];
    return sentence.split(/\s*,\s*|\s+(?:and then|and also|and|then)\s+/).map(clean).filter(Boolean);
  });
}

function clean(s: string) {
  return s.replace(/[.,!?]+$/g, "").replace(/\s+/g, " ").trim();
}
