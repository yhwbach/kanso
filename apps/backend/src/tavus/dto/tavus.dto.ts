import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class TavusStatusView {
  @ApiProperty({ description: "True when both TAVUS_API_KEY and TAVUS_PAL_ID are set." })
  configured!: boolean;

  @ApiProperty({ nullable: true, type: String })
  palId!: string | null;

  @ApiProperty()
  hasApiKey!: boolean;
}

export class CreateConversationRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}

export class ConversationView {
  @ApiProperty({ example: "c123456" })
  conversation_id!: string;

  @ApiProperty({ example: "https://tavus.daily.co/c123456", description: "Pass this to the Conversation component." })
  conversation_url!: string;

  @ApiProperty({ example: "active" })
  status!: string;
}
