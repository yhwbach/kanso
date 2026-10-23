import { BadRequestException, Body, Controller, Delete, Get, Logger, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiErrorResponse } from "@/platform/http/api-error";
import { ToolRegistry } from "@/platform/tools/tool-registry.service";
import { HomeService } from "@/home";
import { CodegenService, CODEGEN_SYSTEM_PROMPT } from "@/codegen";
import { ToolsService } from "@/tools/services/tools.service";
import { ExtensionLoader } from "@/tools/services/extension-loader.service";
import { RunToolRequest, RunToolResponse, SaveToolSourceRequest, SaveToolSourceResponse, ScaffoldToolRequest, ScaffoldToolResponse, ToolSourceView, ToolsOverview } from "@/tools/dto/tools.dto";
import { OkResponse } from "@/home/dto/home.dto";

@ApiTags("tools")
@Controller("api/tools")
export class ToolsController {
  private readonly logger = new Logger(ToolsController.name);

  constructor(
    private readonly tools: ToolsService,
    private readonly loader: ExtensionLoader,
    private readonly registry: ToolRegistry,
    private readonly codegen: CodegenService,
    private readonly home: HomeService,
  ) {}

  @Get()
  @ApiOperation({ operationId: "listTools", summary: "Every registered tool plus the state of each extension file." })
  @ApiOkResponse({ type: ToolsOverview })
  list(): ToolsOverview {
    return { tools: this.tools.list(), extensions: this.loader.list(), codegen: this.codegen.status(), extensionsDir: this.loader.dir };
  }

  @Get("prompt")
  @ApiOperation({ operationId: "getCodegenPrompt", summary: "The system prompt sent to Bedrock when generating a tool." })
  @ApiOkResponse({ schema: { type: "object", properties: { system: { type: "string" } }, required: ["system"] } })
  prompt() {
    return { system: CODEGEN_SYSTEM_PROMPT };
  }

  @Post("scaffold")
  @ApiOperation({ operationId: "scaffoldTool", summary: "Generate a tool from a spoken intent and hot-load it." })
  @ApiOkResponse({ type: ScaffoldToolResponse })
  @ApiBadRequestResponse({ type: ApiErrorResponse })
  async scaffold(@Body() body: ScaffoldToolRequest): Promise<ScaffoldToolResponse> {
    const userId = await this.home.resolveUserId(body.userId);
    try {
      return await this.tools.scaffold(userId, body.intent.trim());
    } catch (err) {
      this.logger.error(`Generated tool failed validation: ${(err as Error).message}`);
      throw new BadRequestException("Kanso couldn't build that automation. Try describing it a little differently.");
    }
  }

  @Get(":name/source")
  @ApiOperation({ operationId: "getToolSource", summary: "Read the TypeScript behind a tool." })
  @ApiOkResponse({ type: ToolSourceView })
  @ApiNotFoundResponse({ type: ApiErrorResponse })
  async source(@Param("name") name: string): Promise<ToolSourceView> {
    const tool = this.registry.get(name);
    if (!tool) throw new NotFoundException(`Unknown tool ${name}`);
    if (!tool.filePath) return { name, editable: false, source: "core", code: null };
    const fileName = tool.filePath.split(/[\\/]/).pop()!;
    return { name, editable: true, source: "extension", fileName, code: await this.loader.readSource(fileName) };
  }

  @Put("files/:fileName")
  @ApiOperation({ operationId: "saveToolSource", summary: "Overwrite an extension file. The watcher reloads it at once." })
  @ApiOkResponse({ type: SaveToolSourceResponse })
  @ApiBadRequestResponse({ type: ApiErrorResponse })
  async save(@Param("fileName") fileName: string, @Body() body: SaveToolSourceRequest): Promise<SaveToolSourceResponse> {
    try {
      const { record, tool } = await this.loader.install(fileName, body.code);
      return { tool: this.tools.view(tool), record };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Delete("files/:fileName")
  @ApiOperation({ operationId: "deleteToolFile", summary: "Delete an extension file and unregister its tool." })
  @ApiOkResponse({ type: OkResponse })
  async remove(@Param("fileName") fileName: string): Promise<OkResponse> {
    await this.loader.remove(fileName);
    return { ok: true };
  }

  @Post(":name/run")
  @ApiOperation({ operationId: "runTool", summary: "Invoke a tool directly, the way the PAL would over MCP." })
  @ApiOkResponse({ type: RunToolResponse })
  @ApiBadRequestResponse({ type: ApiErrorResponse })
  async run(@Param("name") name: string, @Body() body: RunToolRequest): Promise<RunToolResponse> {
    const userId = await this.home.resolveUserId(body.userId);
    try {
      return await this.tools.run(userId, name, body.input ?? {}, "local");
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}
