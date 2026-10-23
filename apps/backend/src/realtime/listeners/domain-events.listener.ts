import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  DOMAIN_EVENTS,
  type CommandHandledEvent,
  type DeviceUnreachableEvent,
  type DeviceUpdatedEvent,
  type NotificationEvent,
  type TavusWebhookEvent,
  type TimerEvent,
  type ToolEvent,
  type ToolInvalidEvent,
  type ToolInvokedEvent,
  type ToolScaffoldedEvent,
} from "@/platform/events/domain-events";
import { RealtimeService } from "@/realtime/realtime.service";

/** Forwards domain events to browser clients over SSE. */
@Injectable()
export class DomainEventsListener {
  constructor(private readonly realtime: RealtimeService) {}

  @OnEvent(DOMAIN_EVENTS.DEVICE_UPDATED)
  onDeviceUpdated(e: DeviceUpdatedEvent) {
    this.realtime.publish("device.updated", e.device, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.DEVICE_UNREACHABLE)
  onDeviceUnreachable(e: DeviceUnreachableEvent) {
    this.realtime.publish("device.unreachable", e, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.TIMER_CREATED)
  onTimerCreated(e: TimerEvent) {
    this.realtime.publish("timer.created", e.timer, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.TIMER_FINISHED)
  onTimerFinished(e: TimerEvent) {
    this.realtime.publish("timer.finished", e.timer, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.TIMER_CANCELLED)
  onTimerCancelled(e: TimerEvent) {
    this.realtime.publish("timer.cancelled", e.timer, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.COMMAND_HANDLED)
  onCommandHandled(e: CommandHandledEvent) {
    this.realtime.publish("command.handled", e, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.TOOL_REGISTERED)
  onToolRegistered(e: ToolEvent) {
    this.realtime.publish("tool.registered", e);
  }

  @OnEvent(DOMAIN_EVENTS.TOOL_UNREGISTERED)
  onToolUnregistered(e: ToolEvent) {
    this.realtime.publish("tool.unregistered", e);
  }

  @OnEvent(DOMAIN_EVENTS.TOOL_SCAFFOLDED)
  onToolScaffolded(e: ToolScaffoldedEvent) {
    this.realtime.publish("tool.scaffolded", e, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.TOOL_INVALID)
  onToolInvalid(e: ToolInvalidEvent) {
    this.realtime.publish("tool.invalid", e);
  }

  @OnEvent(DOMAIN_EVENTS.TOOL_INVOKED)
  onToolInvoked(e: ToolInvokedEvent) {
    if (e.source !== "local") this.realtime.publish("tool.invoked", e, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.NOTIFICATION)
  onNotification(e: NotificationEvent) {
    this.realtime.publish("notification", e, e.userId);
  }

  @OnEvent(DOMAIN_EVENTS.TAVUS_WEBHOOK)
  onTavusWebhook(e: TavusWebhookEvent) {
    this.realtime.publish("tavus.webhook", e);
  }
}
