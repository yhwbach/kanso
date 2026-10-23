import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { HomeService } from "@/home";
import { CommandsService } from "@/commands/services/commands.service";
import { CommandLogView, TelemetrySummary } from "@/commands/dto/commands.dto";

@ApiTags("privacy")
@Controller("api/privacy")
export class PrivacyController {
  constructor(
    private readonly commands: CommandsService,
    private readonly home: HomeService,
  ) {}

  @Get("log")
  @ApiOperation({ operationId: "getCommandLog", summary: "Recent commands with their raw and redacted text." })
  @ApiQuery({ name: "userId", required: false })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50, maximum: 200 } })
  @ApiOkResponse({ type: [CommandLogView] })
  async log(@Query("userId") userId?: string, @Query("limit") limit?: string): Promise<CommandLogView[]> {
    return this.commands.recent(await this.home.resolveUserId(userId), Math.min(200, Number(limit) || 50));
  }

  @Get("telemetry")
  @ApiOperation({ operationId: "getTelemetry", summary: "What left the home, aggregated.", description: "Counts of anonymized action tags, how many commands touched a cloud service, and average latency per stage." })
  @ApiQuery({ name: "userId", required: false })
  @ApiOkResponse({ type: TelemetrySummary })
  async telemetry(@Query("userId") userId?: string): Promise<TelemetrySummary> {
    return this.commands.telemetry(await this.home.resolveUserId(userId));
  }
}
