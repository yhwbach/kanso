import { Module } from "@nestjs/common";
import { CodegenService } from "@/codegen/services/codegen.service";

@Module({ providers: [CodegenService], exports: [CodegenService] })
export class CodegenModule {}
