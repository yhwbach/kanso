import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ToolView {
  @ApiProperty({ example: "control_device" })
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: ["core", "extension"], description: "Core tools ship with Kanso. Extensions are files in the extensions directory." })
  source!: "core" | "extension";

  @ApiPropertyOptional({ example: "check-front-door-m1x9k2.ts", description: "Set for extensions only." })
  fileName?: string;

  @ApiProperty({ format: "date-time" })
  registeredAt!: string;

  @ApiProperty({ type: "object", additionalProperties: true, description: "JSON Schema for the tool input." })
  inputSchema!: Record<string, unknown>;
}

export class ExtensionView {
  @ApiProperty()
  fileName!: string;

  @ApiPropertyOptional()
  toolName?: string;

  @ApiProperty({ enum: ["loaded", "error"] })
  status!: "loaded" | "error";

  @ApiPropertyOptional({ description: "Why the file could not be loaded." })
  error?: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiPropertyOptional({ description: "The spoken request this tool was generated from." })
  intent?: string;

  @ApiPropertyOptional({ enum: ["bedrock", "local-template"] })
  engine?: string;

  @ApiPropertyOptional({ example: "20:40", description: "Local 24-hour time the automation runs on its own every day." })
  daily?: string;
}

export class CodegenStatusView {
  @ApiProperty({ description: "True when AWS credentials are present and Bedrock will be used." })
  configured!: boolean;

  @ApiProperty({ example: "anthropic.claude-opus-5-5" })
  modelId!: string;

  @ApiProperty({ nullable: true, type: String })
  region!: string | null;
}

export class ToolsOverview {
  @ApiProperty({ type: [ToolView] })
  tools!: ToolView[];

  @ApiProperty({ type: [ExtensionView] })
  extensions!: ExtensionView[];

  @ApiProperty({ type: CodegenStatusView })
  codegen!: CodegenStatusView;

  @ApiProperty({ description: "Absolute path of the watched extensions directory." })
  extensionsDir!: string;
}

export class ToolSourceView {
  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "Core tools cannot be edited." })
  editable!: boolean;

  @ApiProperty({ enum: ["core", "extension"] })
  source!: "core" | "extension";

  @ApiPropertyOptional()
  fileName?: string;

  @ApiProperty({ nullable: true, type: String })
  code!: string | null;
}

export class SaveToolSourceRequest {
  @ApiProperty({ description: "The full TypeScript file contents." })
  @IsString()
  @MinLength(1)
  code!: string;
}

export class ScaffoldToolRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: "check my front door lock and alert me if it is unlocked after 10 PM" })
  @IsString()
  @MinLength(8)
  @MaxLength(600)
  intent!: string;
}

export class ScaffoldToolResponse {
  @ApiProperty({ type: ToolView })
  tool!: ToolView;

  @ApiProperty()
  fileName!: string;

  @ApiProperty({ description: "The generated TypeScript." })
  code!: string;

  @ApiProperty({ enum: ["bedrock", "local-template"] })
  engine!: "bedrock" | "local-template";

  @ApiPropertyOptional()
  modelId?: string;

  @ApiProperty({ description: "Generation time in milliseconds." })
  ms!: number;

  @ApiPropertyOptional({ example: "20:40", description: "Local 24-hour time the automation runs on its own every day." })
  daily?: string;
}

export class SaveToolSourceResponse {
  @ApiProperty({ type: ToolView })
  tool!: ToolView;

  @ApiProperty({ type: ExtensionView })
  record!: ExtensionView;
}

export class RunToolRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}

export class RunToolResponse {
  @ApiProperty({ type: "object", additionalProperties: true, description: "Whatever the tool returned." })
  result!: unknown;

  @ApiProperty()
  ms!: number;
}
