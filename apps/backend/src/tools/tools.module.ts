import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HomeModule } from "@/home";
import { CodegenModule } from "@/codegen";
import { ToolOrigin, ToolOriginSchema } from "@/tools/entities/tool-origin.entity";
import { ExtensionLoader } from "@/tools/services/extension-loader.service";
import { ToolsService } from "@/tools/services/tools.service";
import { AutomationScheduler } from "@/tools/services/automation-scheduler.service";
import { ToolsController } from "@/tools/tools.controller";

@Module({
  imports: [HomeModule, CodegenModule, MongooseModule.forFeature([{ name: ToolOrigin.name, schema: ToolOriginSchema }])],
  providers: [ExtensionLoader, ToolsService, AutomationScheduler],
  controllers: [ToolsController],
  exports: [ToolsService],
})
export class ToolsModule {}
