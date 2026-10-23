import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HomeModule } from "@/home";
import { LocalAiModule } from "@/local-ai";
import { CommandLog, CommandLogSchema } from "@/commands/entities/command-log.entity";
import { CommandsService } from "@/commands/services/commands.service";
import { CommandsController } from "@/commands/commands.controller";
import { PrivacyController } from "@/commands/privacy.controller";

@Module({
  imports: [MongooseModule.forFeature([{ name: CommandLog.name, schema: CommandLogSchema }]), HomeModule, LocalAiModule],
  providers: [CommandsService],
  controllers: [CommandsController, PrivacyController],
  exports: [CommandsService],
})
export class CommandsModule {}
