import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { ApiErrorResponse } from "@/platform/http/api-error";
import { HomeService } from "@/home";
import { OkResponse } from "@/home/dto/home.dto";
import { TavusService } from "@/tavus/services/tavus.service";
import { ConversationView, CreateConversationRequest, TavusStatusView } from "@/tavus/dto/tavus.dto";

@ApiTags("tavus")
@Controller("api/tavus")
export class TavusController {
  constructor(
    private readonly tavus: TavusService,
    private readonly home: HomeService,
  ) {}

  @Get("status")
  @ApiOperation({ operationId: "getTavusStatus", summary: "Whether the PAL can be started." })
  @ApiOkResponse({ type: TavusStatusView })
  status(): TavusStatusView {
    return this.tavus.status();
  }

  @Post("conversations")
  @ApiOperation({ operationId: "createConversation", summary: "Start a video conversation with the Kanso PAL.", description: "The Tavus API key stays on the server. The browser only receives the conversation URL." })
  @ApiOkResponse({ type: ConversationView })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponse })
  async create(@Body() body: CreateConversationRequest): Promise<ConversationView> {
    const userId = await this.home.resolveUserId(body.userId);
    const snapshot = await this.home.snapshot(userId);
    return this.tavus.createConversation({ userName: snapshot.user.name, userId, environmentLabel: snapshot.activeHome.name });
  }

  @Post("conversations/:id/end")
  @ApiOperation({ operationId: "endConversation", summary: "End a conversation so it stops billing." })
  @ApiOkResponse({ type: OkResponse })
  end(@Param("id") id: string): Promise<OkResponse> {
    return this.tavus.endConversation(id);
  }

  @Post("webhook")
  @ApiExcludeEndpoint()
  webhook(@Body() body: Record<string, unknown>) {
    return this.tavus.handleWebhook(body ?? {});
  }
}
