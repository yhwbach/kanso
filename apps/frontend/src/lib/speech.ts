type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  addEventListener(type: "result", listener: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void): void;
  addEventListener(type: "error", listener: (e: { error: string }) => void): void;
  addEventListener(type: "end", listener: () => void): void;
  start(): void;
  stop(): void;
  abort(): void;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

function ctor(): SpeechRecognitionCtor | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export const browserSpeechSupported = () => ctor() !== null;

export interface SpeechSession {
  result: Promise<{ text: string; ms: number }>;
  stop(): void;
}

export function listenOnce(): SpeechSession {
  const Recognition = ctor();
  if (!Recognition) throw new Error("This browser has no speech recognizer");
  const rec = new Recognition();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  const started = Date.now();
  const result = new Promise<{ text: string; ms: number }>((resolve, reject) => {
    let text = "";
    rec.addEventListener("result", (e) => {
      text = e.results[0]?.[0]?.transcript ?? "";
    });
    rec.addEventListener("error", (e) => reject(new Error(e.error)));
    rec.addEventListener("end", () => resolve({ text, ms: Date.now() - started }));
    rec.start();
  });
  return { result, stop: () => rec.stop() };
}
