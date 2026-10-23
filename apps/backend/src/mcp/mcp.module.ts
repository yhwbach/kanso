import { Module } from "@nestjs/common";
import { HomeModule } from "@/home";
import { OAuthModule } from "@/oauth";
import { McpController } from "@/mcp/mcp.controller";

@Module({ imports: [HomeModule, OAuthModule], controllers: [McpController] })
export class McpModule {}
