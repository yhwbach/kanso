import { Module } from "@nestjs/common";
import { HomeModule } from "@/home";
import { TavusService } from "@/tavus/services/tavus.service";
import { TavusController } from "@/tavus/tavus.controller";

@Module({ imports: [HomeModule], providers: [TavusService], controllers: [TavusController] })
export class TavusModule {}
