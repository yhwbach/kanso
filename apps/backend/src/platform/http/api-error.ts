import { ApiProperty } from "@nestjs/swagger";

export class ApiErrorResponse {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: "text is required", description: "What went wrong, in plain words." })
  message!: string;

  @ApiProperty({ example: "Bad Request", required: false })
  error?: string;
}
