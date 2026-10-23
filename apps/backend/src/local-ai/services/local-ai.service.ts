import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@/platform/config/config.service";

export interface RedactionResult {
  redactedText: string;
  piiDetected: boolean;
  labels: string[];
  engine: "desert-ant-redact" | "pattern-fallback";
  ms: number;
}

export interface TranscriptionResult {
  text: string;
  words: { text: string; start: number; end: number }[];
  ms: number;
  engine: "desert-ant-voz";
}

export interface EnhancedAudio {
  samples: Float32Array;
  sampleRate: number;
  ms: number;
  engine: "desert-ant-clear" | "none";
}

export interface TopicResult {
  topics: string[];
  ms: number;
  engine: "desert-ant-gist" | "keyword-fallback";
}

type ModelState = "idle" | "loading" | "ready" | "unavailable";

type Voz = { transcribe(input: unknown): Promise<{ text: string; words?: { text: string; start: number; end: number }[] }> };
type Redact = { redaction(text: string): Promise<{ redactedText: string; items: { label: string; original: string; placeholder: string; start: number; end: number }[] }> };
type Clear = { enhance(samples: Float32Array, sampleRate: number): Promise<{ samples: Float32Array }> };
type Gist = { classify(text: string, opts?: { topK?: number }): Promise<{ slug: string }[]> };

@Injectable()
export class LocalAiService implements OnModuleInit {
  private readonly logger = new Logger(LocalAiService.name);
  private voz: Voz | null = null;
  private redact: Redact | null = null;
  private gist: Gist | null = null;
  private clear: Clear | null = null;
  private readonly loading = new Map<string, Promise<void>>();
  private readonly errors: Record<string, string> = {};

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return this.config.get("LOCAL_AI") === "on";
  }

  status() {
    const state = (name: string, loaded: unknown): ModelState =>
      loaded ? "ready" : this.loading.has(name) ? "loading" : this.errors[name] ? "unavailable" : "idle";
    return {
      enabled: this.enabled,
      voz: state("voz", this.voz),
      redact: state("redact", this.redact),
      gist: state("gist", this.gist),
      clear: state("clear", this.clear),
      errors: { ...this.errors },
    };
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn("LOCAL_AI=off. Transcription is disabled and PII redaction uses the pattern fallback.");
      return;
    }
    if (this.config.get("PRELOAD_MODELS") === "true") void this.preload();
  }

  async preload() {
    await Promise.allSettled([this.loadRedact(), this.loadGist(), this.loadVoz(), this.loadClear()]);
    this.logger.log(`Local models: ${JSON.stringify(this.status())}`);
  }

  /** Denoises and dereverbs a recording before it is transcribed. Passes the audio through untouched until Clear has loaded. */
  async enhance(samples: Float32Array, sampleRate: number): Promise<EnhancedAudio> {
    void this.loadClear();
    if (!this.clear) return { samples, sampleRate, ms: 0, engine: "none" };
    const started = Date.now();
    const r = await this.clear.enhance(samples, sampleRate);
    return { samples: r.samples, sampleRate: 48_000, ms: Date.now() - started, engine: "desert-ant-clear" };
  }

  async transcribe(audio: { samples: Float32Array; sampleRate: number }): Promise<TranscriptionResult> {
    void this.loadVoz();
    if (!this.voz) throw new Error(this.errors.voz ? `Local transcription unavailable: ${this.errors.voz}` : this.loading.has("voz") ? "Local transcription is still loading" : "Local transcription is disabled");
    const started = Date.now();
    const r = await this.voz.transcribe(audio);
    return { text: r.text.trim(), words: r.words ?? [], ms: Date.now() - started, engine: "desert-ant-voz" };
  }

  // Commands never wait on a model download. The fallback answers until the model is ready.
  /** `known` holds the user's own device and room names. Those and short numbers like "68" are never personal data. */
  async redactPii(text: string, known: string[] = []): Promise<RedactionResult> {
    void this.loadRedact();
    const started = Date.now();
    if (this.redact) {
      const r = await this.redact.redaction(text);
      const normalize = (s: string) => s.toLowerCase().replace(/^(?:the|my)\s+/, "").trim();
      const names = known.map(normalize);
      const items = r.items.filter((i) => !names.includes(normalize(i.original)) && !/^\d{1,3}(?:\.\d+)?$/.test(i.original.trim()));
      let redactedText = "";
      let cursor = 0;
      for (const item of items) {
        redactedText += text.slice(cursor, item.start) + item.placeholder;
        cursor = item.end;
      }
      redactedText += text.slice(cursor);
      return { redactedText, piiDetected: items.length > 0, labels: [...new Set(items.map((i) => i.label))], engine: "desert-ant-redact", ms: Date.now() - started };
    }
    return { ...this.patternRedact(text), engine: "pattern-fallback", ms: Date.now() - started };
  }

  async topics(text: string): Promise<TopicResult> {
    void this.loadGist();
    const started = Date.now();
    if (this.gist) {
      try {
        const r = await this.gist.classify(text, { topK: 3 });
        return { topics: r.map((x) => x.slug), ms: Date.now() - started, engine: "desert-ant-gist" };
      } catch (err) {
        this.logger.warn(`Gist classify failed: ${(err as Error).message}`);
      }
    }
    return { topics: this.keywordTopics(text), ms: Date.now() - started, engine: "keyword-fallback" };
  }

  private loadVoz() {
    return this.load("voz", async () => {
      const [{ Voz }, ort] = await Promise.all([import("@desert-ant-labs/voz"), import("onnxruntime-node")]);
      this.voz = (await Voz.load({ ort })) as unknown as Voz;
    });
  }

  private loadClear() {
    return this.load("clear", async () => {
      const { Clear } = await import("@desert-ant-labs/clear/native");
      this.clear = (await Clear.load()) as unknown as Clear;
    });
  }

  private loadRedact() {
    return this.load("redact", async () => {
      const { Redact } = await import("@desert-ant-labs/redact/native");
      this.redact = (await Redact.load()) as unknown as Redact;
    });
  }

  private loadGist() {
    return this.load("gist", async () => {
      const { Gist } = await import("@desert-ant-labs/gist/native");
      this.gist = (await Gist.load()) as unknown as Gist;
    });
  }

  private load(name: "voz" | "redact" | "gist" | "clear", run: () => Promise<void>): Promise<void> {
    if (!this.enabled || this[name] || this.errors[name]) return Promise.resolve();
    const existing = this.loading.get(name);
    if (existing) return existing;
    const started = Date.now();
    const task = run()
      .then(() => this.logger.log(`${name} ready in ${Date.now() - started}ms`))
      .catch((err) => {
        this.errors[name] = String((err as Error)?.message ?? err);
        this.logger.warn(`${name} unavailable: ${this.errors[name]}`);
      })
      .finally(() => this.loading.delete(name));
    this.loading.set(name, task);
    return task;
  }

  private patternRedact(text: string): Omit<RedactionResult, "engine" | "ms"> {
    const labels = new Set<string>();
    let out = text;
    const rules: [RegExp, string][] = [
      [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "EMAIL"],
      [/(\+?\d{1,2}[\s.-]?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]\d{4}\b/g, "PHONE"],
      [/\b(?:\d[ -]*?){13,16}\b/g, "CARD"],
      [/\b\d{3}-\d{2}-\d{4}\b/g, "SSN"],
      [/\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd)\b\.?/g, "ADDRESS"],
    ];
    for (const [re, label] of rules) {
      let n = 0;
      out = out.replace(re, () => {
        n++;
        labels.add(label);
        return `[${label}_${n}]`;
      });
    }
    return { redactedText: out, piiDetected: labels.size > 0, labels: [...labels] };
  }

  private keywordTopics(text: string): string[] {
    const t = text.toLowerCase();
    const topics: string[] = [];
    if (/\b(light|lamp|lights)\b/.test(t)) topics.push("home-lighting");
    if (/\b(lock|door|unlock)\b/.test(t)) topics.push("home-security");
    if (/\b(timer|minute|minutes|second|seconds|hour)\b/.test(t)) topics.push("productivity");
    if (/\b(temperature|thermostat|degrees|heat|cool|ac)\b/.test(t)) topics.push("climate");
    if (/\b(tool|automation|routine|create|build)\b/.test(t)) topics.push("automation");
    if (/\b(call|text|message|email)\b/.test(t)) topics.push("communication");
    return topics.length ? topics : ["home-general"];
  }
}
