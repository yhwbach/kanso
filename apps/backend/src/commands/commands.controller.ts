import { BadRequestException, Body, Controller, Headers, Post, Query, Req, ServiceUnavailableException } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBody, ApiConsumes, ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { ApiErrorResponse } from "@/platform/http/api-error";
import { HomeService } from "@/home";
import { LocalAiService } from "@/local-ai";
import { CommandsService } from "@/commands/services/commands.service";
import { wavToMono16k } from "@/commands/services/wav";
import { CommandResult, TextCommandRequest } from "@/commands/dto/commands.dto";

@ApiTags("commands")
@Controller("api")
export class CommandsController {
  constructor(
    private readonly commands: CommandsService,
    private readonly home: HomeService,
    private readonly ai: LocalAiService,
  ) {}

  @Post("commands")
  @ApiOperation({ operationId: "sendTextCommand", summary: "Run a typed or already transcribed command.", description: "The text is redacted on-device, routed to the matching tools, and logged." })
  @ApiOkResponse({ type: CommandResult })
  @ApiBadRequestResponse({ type: ApiErrorResponse })
  async text(@Body() body: TextCommandRequest): Promise<CommandResult> {
    const userId = await this.home.resolveUserId(body.userId);
    const latency: Record<string, number> = {};
    if (typeof body.transcribeMs === "number") latency.transcribe = body.transcribeMs;
    const result = await this.commands.handleText(userId, body.text.trim(), { latency });
    return { ...result, engines: { ...result.engines, transcribe: body.engine ?? "typed" } };
  }

  @Post("voice/command")
  @ApiOperation({
    operationId: "sendVoiceCommand",
    summary: "Run a spoken command from a WAV recording.",
    description: "The audio is transcribed on-device with Desert Ant Voz and then handled like a text command. Returns 503 with code TRANSCRIPTION_UNAVAILABLE when the model is not loaded, in which case the client should transcribe in the browser and call the text endpoint.",
  })
  @ApiConsumes("audio/wav")
  @ApiBody({ schema: { type: "string", format: "binary" }, description: "A RIFF WAV file. Any sample rate, PCM16 or float32, mono or stereo." })
  @ApiQuery({ name: "userId", required: false })
  @ApiHeader({ name: "x-user-id", required: false })
  @ApiOkResponse({ type: CommandResult })
  @ApiBadRequestResponse({ type: ApiErrorResponse })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponse })
  async audio(@Req() req: Request, @Query("userId") userIdQuery?: string, @Headers("x-user-id") userIdHeader?: string): Promise<CommandResult> {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length < 100) throw new BadRequestException("Send a WAV body");
    const status = this.ai.status();
    if (!status.enabled || status.voz === "unavailable") {
      throw new ServiceUnavailableException({ statusCode: 503, code: "TRANSCRIPTION_UNAVAILABLE", message: status.errors.voz ?? "Local transcription is disabled" });
    }
    const userId = await this.home.resolveUserId(userIdQuery ?? userIdHeader);
    let samples: Float32Array;
    try {
      samples = wavToMono16k(body);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (samples.length < 1600) throw new BadRequestException("Recording too short");
    const enhanced = await this.ai.enhance(samples, 16_000);
    let transcript;
    try {
      transcript = await this.ai.transcribe({ samples: enhanced.samples, sampleRate: enhanced.sampleRate });
    } catch (err) {
      throw new ServiceUnavailableException({ statusCode: 503, code: "TRANSCRIPTION_UNAVAILABLE", message: (err as Error).message });
    }
    if (!transcript.text) throw new BadRequestException("I didn't hear anything.");
    const result = await this.commands.handleText(userId, transcript.text, { latency: { enhance: enhanced.ms, transcribe: transcript.ms } });
    return { ...result, engines: { ...result.engines, enhance: enhanced.engine, transcribe: transcript.engine } };
  }
}
