import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@/platform/config/config.service";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";

@Global()
@Module({
  providers: [ConfigService, ToolRegistry],
  exports: [ConfigService, ToolRegistry],
})
export class PlatformModule {}
