import { Module } from "@nestjs/common";
import { RealtimeService } from "@/realtime/realtime.service";
import { RealtimeController } from "@/realtime/realtime.controller";
import { DomainEventsListener } from "@/realtime/listeners/domain-events.listener";

@Module({
  providers: [RealtimeService, DomainEventsListener],
  controllers: [RealtimeController],
})
export class RealtimeModule {}
