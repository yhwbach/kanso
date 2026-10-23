import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@/platform/config/config.service";
import { DOMAIN_EVENTS, type TavusWebhookEvent } from "@/platform/events/domain-events";

const API = "https://tavusapi.com/v2";

export interface TavusConversation {
  conversation_id: string;
  conversation_url: string;
  status: string;
}

@Injectable()
export class TavusService {
  private readonly logger = new Logger(TavusService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  get configured() {
    return Boolean(this.config.get("TAVUS_API_KEY") && this.config.get("TAVUS_PAL_ID"));
  }

  status() {
    return { configured: this.configured, palId: this.config.get("TAVUS_PAL_ID") ?? null, hasApiKey: Boolean(this.config.get("TAVUS_API_KEY")) };
  }

  async createConversation(opts: { userName: string; userId: string; environmentLabel: string }): Promise<TavusConversation> {
    if (!this.configured) throw new ServiceUnavailableException("Tavus is not configured. Set TAVUS_API_KEY and TAVUS_PAL_ID, or run pnpm tavus:setup.");
    const publicUrl = this.config.publicUrl;
    const body: Record<string, unknown> = {
      pal_id: this.config.get("TAVUS_PAL_ID"),
      conversation_name: `Kanso with ${opts.userName}`,
      conversational_context: `The user's name is ${opts.userName}. They are at ${opts.environmentLabel}. Kanso user id: ${opts.userId}. Keep replies to one sentence.`,
      custom_greeting: `Hi ${opts.userName}. What do you need?`,
      properties: { max_call_duration: 900, participant_left_timeout: 30, enable_closed_captions: true },
    };
    const faceId = this.config.get("TAVUS_FACE_ID");
    if (faceId) body.face_id = faceId;
    if (publicUrl.startsWith("https://")) body.callback_url = `${publicUrl}/api/tavus/webhook`;
    const conversation = await this.call<TavusConversation>("/conversations", { method: "POST", body: JSON.stringify(body) });
    this.logger.log(`Conversation ${conversation.conversation_id} created for ${opts.userName}`);
    return conversation;
  }

  async endConversation(conversationId: string) {
    try {
      await this.call(`/conversations/${conversationId}/end`, { method: "POST" });
    } catch (err) {
      this.logger.warn(`End conversation failed: ${(err as Error).message}`);
    }
    return { ok: true };
  }

  handleWebhook(payload: Record<string, unknown>) {
    const eventType = String(payload.event_type ?? payload.message_type ?? "unknown");
    this.logger.log(`Webhook ${eventType}`);
    this.events.emit(DOMAIN_EVENTS.TAVUS_WEBHOOK, { eventType, payload } satisfies TavusWebhookEvent);
    return { ok: true };
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const key = this.config.get("TAVUS_API_KEY");
    if (!key) throw new ServiceUnavailableException("TAVUS_API_KEY is not set");
    const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", "x-api-key": key, ...(init.headers ?? {}) } });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`Tavus ${init.method ?? "GET"} ${path} returned ${res.status}: ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException(`Tavus ${res.status}: ${text.slice(0, 300)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }
}
