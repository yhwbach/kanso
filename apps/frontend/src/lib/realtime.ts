import { useEffect } from "react";
import { BACKEND_URL } from "@/api/http";
import { useStore } from "@/lib/store";
import { parseRealtimeEvent, REALTIME_EVENT_TYPES } from "@/lib/events";

export function useRealtime(userId: string | undefined) {
  const applyEvent = useStore((s) => s.applyEvent);
  useEffect(() => {
    if (!userId) return undefined;
    const source = new EventSource(`${BACKEND_URL}/api/events?userId=${encodeURIComponent(userId)}`);
    const onMessage = (e: MessageEvent<string>) => {
      try {
        const event = parseRealtimeEvent(JSON.parse(e.data));
        if (event) applyEvent(event);
      } catch {
        /* not JSON: ignore the frame */
      }
    };
    for (const type of REALTIME_EVENT_TYPES) source.addEventListener(type, onMessage);
    return () => source.close();
  }, [userId, applyEvent]);
}
