import { Controller, Query, Sse } from "@nestjs/common";
import { ApiOperation, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Observable, interval, map, merge } from "rxjs";
import { RealtimeService } from "@/realtime/realtime.service";

@ApiTags("realtime")
@Controller("api/events")
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse()
  @ApiOperation({
    operationId: "streamEvents",
    summary: "Server-sent events for live UI updates.",
    description:
      "Each message has type, payload, userId and at. Types: device.updated, device.unreachable, timer.created, timer.finished, timer.cancelled, command.handled, tool.registered, tool.unregistered, tool.scaffolded, tool.invalid, tool.invoked, notification, tavus.webhook. A heartbeat is sent every 25 seconds.",
  })
  @ApiQuery({ name: "userId", required: false })
  @ApiProduces("text/event-stream")
  stream(@Query("userId") userId?: string): Observable<MessageEvent> {
    const heartbeat = interval(25_000).pipe(map(() => ({ type: "heartbeat", data: { type: "heartbeat", at: new Date().toISOString() } }) as unknown as MessageEvent));
    return merge(this.realtime.stream(userId), heartbeat);
  }
}
