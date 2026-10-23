import { Injectable } from "@nestjs/common";
import { Observable, Subject, filter, map } from "rxjs";

export interface RealtimeMessage {
  type: string;
  userId?: string;
  payload: unknown;
  at: string;
}

@Injectable()
export class RealtimeService {
  private readonly subject = new Subject<RealtimeMessage>();

  publish(type: string, payload: unknown, userId?: string) {
    this.subject.next({ type, payload, userId, at: new Date().toISOString() });
  }

  stream(userId?: string): Observable<MessageEvent> {
    return this.subject.pipe(
      filter((m) => !m.userId || !userId || m.userId === userId),
      map((m) => ({ type: m.type, data: m }) as unknown as MessageEvent),
    );
  }
}
