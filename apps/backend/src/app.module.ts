import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { PlatformModule } from "@/platform/platform.module";
import { DatabaseModule } from "@/platform/database/database.module";
import { HomeModule } from "@/home";
import { LocalAiModule } from "@/local-ai";
import { CodegenModule } from "@/codegen";
import { ToolsModule } from "@/tools";
import { CommandsModule } from "@/commands";
import { RealtimeModule } from "@/realtime/realtime.module";
import { OAuthModule } from "@/oauth";
import { McpModule } from "@/mcp/mcp.module";
import { TavusModule } from "@/tavus/tavus.module";

@Module({
  imports: [
    PlatformModule,
    EventEmitterModule.forRoot(),
    DatabaseModule,
    HomeModule,
    LocalAiModule,
    CodegenModule,
    ToolsModule,
    CommandsModule,
    RealtimeModule,
    OAuthModule,
    McpModule,
    TavusModule,
  ],
})
export class AppModule {}
