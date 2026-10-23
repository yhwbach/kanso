import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { LinkCodeError, OAuthService } from "@/oauth/services/oauth.service";
import { consentPage, messagePage } from "@/oauth/views/consent-page";

@ApiExcludeController()
@Controller()
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Get(".well-known/oauth-authorization-server")
  metadata() {
    return this.oauth.metadata();
  }

  @Get(".well-known/oauth-protected-resource")
  protectedResource() {
    return this.oauth.protectedResource();
  }

  @Post("oauth/register")
  async register(@Body() body: { client_name?: string; redirect_uris?: string[] }, @Res() res: Response) {
    try {
      res.status(201).json(await this.oauth.register(body ?? {}));
    } catch (err) {
      const message = (err as Error).message;
      res.status(400).json({ error: message.split(":")[0].trim(), error_description: message });
    }
  }

  @Get("oauth/authorize")
  async authorize(@Query() q: Record<string, unknown>, @Res() res: Response) {
    const params = this.oauth.authorizeParams(q);
    res.type("html").send(consentPage({ clientName: await this.oauth.clientName(params.client_id), params }));
  }

  @Post("oauth/approve")
  async approve(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const params = this.oauth.authorizeParams(body);
    try {
      const code = await this.oauth.approve(params, typeof body.link_code === "string" ? body.link_code : "");
      const url = new URL(params.redirect_uri);
      url.searchParams.set("code", code);
      if (params.state) url.searchParams.set("state", params.state);
      res.redirect(303, url.toString());
    } catch (err) {
      const message = (err as Error).message;
      if (err instanceof LinkCodeError) {
        res.status(400).type("html").send(consentPage({ clientName: await this.oauth.clientName(params.client_id), params, error: message }));
        return;
      }
      res.status(400).type("html").send(messagePage("Can't link this app", message));
    }
  }

  @Post("oauth/token")
  async token(@Body() body: Record<string, string>, @Res() res: Response) {
    res.setHeader("Cache-Control", "no-store");
    try {
      res.json(await this.oauth.exchange(body ?? {}));
    } catch (err) {
      const message = (err as Error).message;
      res.status(400).json({ error: message.split(":")[0].trim(), error_description: message });
    }
  }
}

