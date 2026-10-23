import { All, Controller, Logger, Req, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";
import { HomeService } from "@/home";
import { OAuthService } from "@/oauth";
import { SERVER_INFO } from "@/mcp/mcp.constants";

/**
 * Stateless Streamable HTTP transport: each request builds a server from the
 * live registry, so a tool hot-loaded a second ago is already listed.
 */
@ApiExcludeController()
@Controller("mcp")
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly registry: ToolRegistry,
    private readonly home: HomeService,
    private readonly oauth: OAuthService,
  ) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response) {
    if (!(await this.oauth.authorize(req))) {
      res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${this.oauth.issuer}/.well-known/oauth-protected-resource"`);
      res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
      return;
    }

    const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
    for (const tool of this.registry.list()) {
      server.registerTool(tool.name, { description: tool.description, inputSchema: tool.inputSchema.shape }, async (args: Record<string, unknown>) => {
        const started = Date.now();
        try {
          const userId = await this.home.resolveUserId(typeof args?.userId === "string" ? args.userId : undefined);
          const result = await this.registry.invoke(tool.name, args ?? {}, this.registry.context(userId, "pal"));
          this.logger.log(`${tool.name} ${Date.now() - started}ms`);
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (err) {
          this.logger.warn(`${tool.name} failed: ${(err as Error).message}`);
          return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: (err as Error).message }) }] };
        }
      });
    }

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
