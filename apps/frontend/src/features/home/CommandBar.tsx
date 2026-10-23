import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Mic, Play, Square } from "lucide-react";
import { useStore } from "@/lib/store";
import { MenuNav } from "@/features/shell/SectionNav";
import { startRecording, type Recording } from "@/lib/audio";
import { browserSpeechSupported, listenOnce, type SpeechSession } from "@/lib/speech";
import { useMicLevel, useReplay } from "@/lib/motion";
import { errorMessage } from "@/lib/format";

function micStyle(level: number): React.CSSProperties {
  const style: Record<string, number> = { "--level": level };
  return style;
}

const suggestions: { label: string; text: string }[] = [
  { label: "Lights on, 15 min timer", text: "Turn on the living room lights and set a timer for 15 minutes" },
  { label: "Backyard lights on", text: "Turn on the backyard lights" },
  { label: "Build a door check", text: "Create a tool that checks my front door lock and alerts me if it is unlocked after 10 PM" },
  { label: "Is the door locked?", text: "Is my front door locked?" },
];

export function CommandBar() {
  const sendText = useStore((s) => s.sendText);
  const sendAudio = useStore((s) => s.sendAudio);
  const busy = useStore((s) => s.busy);
  const browserSpeechOnly = useStore((s) => s.browserSpeechOnly);
  const localAi = useStore((s) => s.localAi);
  const toast = useStore((s) => s.toast);
  const view = useStore((s) => s.view);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sends, setSends] = useState(0);
  const level = useMicLevel(stream);
  const lift = useReplay(sends, "pop", 450);
  const recording = useRef<Recording | null>(null);
  const speech = useRef<SpeechSession | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement !== inputRef.current &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    setSends((n) => n + 1);
    await sendText(value, { engine: "typed" });
  };

  const useLocalVoice = !browserSpeechOnly && localAi?.voz === "ready";

  const toggleMic = async () => {
    if (listening) {
      setListening(false);
      setStream(null);
      if (recording.current) {
        const rec = recording.current;
        recording.current = null;
        try {
          await sendAudio(await rec.stop());
        } catch (err) {
          toast("I couldn't hear that", errorMessage(err), "bad");
        }
      }
      speech.current?.stop();
      return;
    }
    try {
      if (useLocalVoice) {
        recording.current = await startRecording();
        setStream(recording.current.stream);
        setListening(true);
        return;
      }
      if (!browserSpeechSupported()) {
        toast("This browser can't listen", "Type it instead.", "bad");
        return;
      }
      const session = listenOnce();
      speech.current = session;
      setListening(true);
      const { text: heard, ms } = await session.result;
      setListening(false);
      speech.current = null;
      if (heard) await sendText(heard, { transcribeMs: ms, engine: "web-speech" });
      else toast("I didn't catch that");
    } catch (err) {
      setListening(false);
      toast("Microphone unavailable", errorMessage(err), "bad");
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 border-t border-line bg-bg/85 px-3 pb-4 pt-4 backdrop-blur-md sm:px-6 sm:pb-6 sm:pt-5">
      {view === "home" && (
        <div className="pointer-events-auto hidden items-center gap-2 md:flex">
          {suggestions.map((s) => (
            <button
              key={s.text}
              onClick={() => void sendText(s.text, { engine: "typed" })}
              disabled={busy}
              className="btn ghost h-9 bg-surface px-3 text-[11px] disabled:opacity-50"
            >
              <Play size={11} fill="currentColor" /> {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="pointer-events-auto flex w-full max-w-[1100px] flex-col gap-2 sm:flex-row sm:items-stretch">
        <MenuNav />
        <form onSubmit={submit} className={`field relative flex min-w-0 flex-1 items-center gap-2 p-2 pl-5 ${busy ? "sweep" : ""}`}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={listening ? "Listening" : "Tell Kanso what to do"}
            className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink3 sm:text-[17px]"
            disabled={busy && !listening}
          />
          <button
            type="button"
            onClick={() => void toggleMic()}
            aria-label={listening ? "Stop" : "Speak"}
            style={micStyle(level)}
            className={`relative grid h-11 w-11 place-items-center cursor-pointer transition-colors ${listening ? "mic-level pulse-ring bg-bad text-white" : "bg-bg2 text-ink hover:bg-line"}`}
          >
            {listening ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
          </button>
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Send"
            className={`grid h-11 w-11 place-items-center bg-ink text-bg cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 ${lift}`}
          >
            <ArrowUp size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
