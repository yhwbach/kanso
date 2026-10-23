import { ApiProperty } from "@nestjs/swagger";

const STATES = ["idle", "loading", "ready", "unavailable"] as const;

export class LocalAiStatusView {
  @ApiProperty({ description: "False when LOCAL_AI=off." })
  enabled!: boolean;

  @ApiProperty({ enum: STATES, description: "Speech recognition (Desert Ant Voz)." })
  voz!: (typeof STATES)[number];

  @ApiProperty({ enum: STATES, description: "PII redaction (Desert Ant Redact)." })
  redact!: (typeof STATES)[number];

  @ApiProperty({ enum: STATES, description: "Topic tagging (Desert Ant Gist)." })
  gist!: (typeof STATES)[number];

  @ApiProperty({ enum: STATES, description: "Speech enhancement before transcription (Desert Ant Clear)." })
  clear!: (typeof STATES)[number];

  @ApiProperty({ type: "object", additionalProperties: { type: "string" }, description: "Load errors keyed by model name." })
  errors!: Record<string, string>;
}
