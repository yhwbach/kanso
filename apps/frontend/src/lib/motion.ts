import { useEffect, useRef, useState } from "react";

/** Returns a class name that replays an animation whenever `key` changes. */
export function useReplay(key: unknown, className: string, duration = 500) {
  const [seen, setSeen] = useState(key);
  const [active, setActive] = useState(false);
  if (key !== seen) {
    setSeen(key);
    setActive(true);
  }
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setActive(false), duration);
    return () => window.clearTimeout(id);
  }, [active, duration]);
  return active ? className : "";
}

/** Counts from the previous value to `value` over ~600ms. */
export function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const delta = value - start;
    if (!delta) return;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + delta * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

/** Drives a 0..1 microphone level from a live stream. */
export function useMicLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) {
        const d = (v - 128) / 128;
        sum += d * d;
      }
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      void ctx.close();
    };
  }, [stream]);
  return stream ? level : 0;
}
