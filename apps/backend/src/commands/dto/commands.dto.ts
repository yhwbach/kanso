import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class TextCommandRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: "Turn on the living room lights and set a timer for 15 minutes" })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;

  @ApiPropertyOptional({ description: "How long the browser took to transcribe, when the text came from speech." })
  @IsOptional()
  @IsInt()
  @Min(0)
  transcribeMs?: number;

  @ApiPropertyOptional({ example: "web-speech", description: "What produced the text: typed, web-speech, or desert-ant-voz." })
  @IsOptional()
  @IsString()
  engine?: string;
}

export class CommandResult {
  @ApiProperty({ description: "False when any action failed, for example a device was not found." })
  ok!: boolean;

  @ApiProperty({ description: "What was heard or typed, before redaction." })
  transcript!: string;

  @ApiProperty({ description: "The text after on-device PII redaction. This is what gets routed and logged." })
  sanitized!: string;

  @ApiProperty()
  piiDetected!: boolean;

  @ApiProperty({ type: [String], example: ["PHONE"] })
  piiLabels!: string[];

  @ApiProperty({ type: [String], example: ["home-lighting"] })
  topics!: string[];

  @ApiProperty({ type: "array", items: { type: "object", additionalProperties: true }, description: "One entry per action taken, with ok, kind, and device fields." })
  actions!: Record<string, unknown>[];

  @ApiProperty({ example: "Living Room Lights on. Timer set for 15 minutes.", description: "Short enough to speak aloud." })
  reply!: string;

  @ApiProperty({ type: "object", additionalProperties: { type: "number" }, example: { transcribe: 140, redact: 12, route: 1, execute: 9, total: 162 } })
  latency!: Record<string, number>;

  @ApiProperty({ description: "True when a cloud service was contacted, which only happens for tool generation." })
  cloudEgress!: boolean;

  @ApiProperty({ type: "object", additionalProperties: { type: "string" }, example: { transcribe: "desert-ant-voz", redact: "desert-ant-redact" } })
  engines!: Record<string, string>;

  @ApiProperty()
  logId!: string;
}

export class CommandLogView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  rawText!: string;

  @ApiProperty()
  sanitizedText!: string;

  @ApiProperty()
  piiDetected!: boolean;

  @ApiProperty({ type: [String] })
  piiLabels!: string[];

  @ApiProperty({ type: [String] })
  topics!: string[];

  @ApiProperty({ enum: ["local", "pal"] })
  source!: "local" | "pal";

  @ApiProperty({ type: "object", additionalProperties: { type: "number" } })
  latency!: Record<string, number>;

  @ApiProperty({ type: "array", items: { type: "object", additionalProperties: true } })
  actions!: Record<string, unknown>[];

  @ApiProperty()
  reply!: string;

  @ApiProperty({ type: "array", items: { type: "object", additionalProperties: { type: "string" } }, description: "The anonymized tags that are the only thing allowed to leave the home." })
  telemetry!: Record<string, string>[];

  @ApiProperty()
  cloudEgress!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  timestamp!: Date;
}

export class LatencySummary {
  @ApiProperty({ nullable: true, type: Number })
  total!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  transcribe!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  redact!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  route!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  execute!: number | null;
}

export class TelemetryEvent {
  @ApiProperty({ type: String, format: "date-time" })
  at!: Date;

  @ApiProperty({ type: "array", items: { type: "object", additionalProperties: { type: "string" } } })
  tags!: Record<string, string>[];

  @ApiProperty()
  cloud!: boolean;
}

export class TelemetrySummary {
  @ApiProperty()
  commands!: number;

  @ApiProperty({ description: "Commands where at least one PII item was redacted." })
  piiRedacted!: number;

  @ApiProperty({ description: "Commands that contacted a cloud service." })
  cloudEgressCount!: number;

  @ApiProperty()
  localOnlyCount!: number;

  @ApiProperty({ type: "object", additionalProperties: { type: "integer" }, example: { control_device: 12, set_timer: 3 } })
  byAction!: Record<string, number>;

  @ApiProperty({ type: "object", additionalProperties: { type: "integer" } })
  byTopic!: Record<string, number>;

  @ApiProperty({ type: LatencySummary, description: "Average milliseconds per stage." })
  avgLatency!: LatencySummary;

  @ApiProperty({ type: [TelemetryEvent] })
  recentTags!: TelemetryEvent[];
}
