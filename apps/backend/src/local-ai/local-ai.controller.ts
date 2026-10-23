import { Controller, Get, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LocalAiService } from "@/local-ai/services/local-ai.service";
import { LocalAiStatusView } from "@/local-ai/dto/local-ai.dto";

@ApiTags("local-ai")
@Controller("api/local-ai")
export class LocalAiController {
  constructor(private readonly ai: LocalAiService) {}

  @Get("status")
  @ApiOperation({ operationId: "getLocalAiStatus", summary: "Which on-device models are loaded." })
  @ApiOkResponse({ type: LocalAiStatusView })
  status(): LocalAiStatusView {
    return this.ai.status();
  }

  @Post("preload")
  @ApiOperation({ operationId: "preloadLocalAi", summary: "Load every model now instead of on first use." })
  @ApiOkResponse({ type: LocalAiStatusView })
  async preload(): Promise<LocalAiStatusView> {
    await this.ai.preload();
    return this.ai.status();
  }
}
