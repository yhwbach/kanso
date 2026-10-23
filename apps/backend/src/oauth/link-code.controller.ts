import { Controller, ForbiddenException, Post, Req } from "@nestjs/common";
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { ApiErrorResponse } from "@/platform/http/api-error";
import { isHomeNetworkRequest } from "@/platform/http/home-network";
import { LinkCodeView } from "@/oauth/dto/link-code.dto";
import { OAuthService } from "@/oauth/services/oauth.service";

@ApiTags("oauth")
@Controller("api/oauth")
export class LinkCodeController {
  constructor(private readonly oauth: OAuthService) {}

  @Post("link-code")
  @ApiOperation({ operationId: "createLinkCode", summary: "Show a code for approving a new app.", description: "Only answers requests from this computer or the home network, never through the public tunnel." })
  @ApiOkResponse({ type: LinkCodeView })
  @ApiForbiddenResponse({ type: ApiErrorResponse })
  createLinkCode(@Req() req: Request): LinkCodeView {
    if (!isHomeNetworkRequest(req)) throw new ForbiddenException("Link codes can only be shown at home, on the same network as Kanso.");
    return this.oauth.newLinkCode();
  }
}
