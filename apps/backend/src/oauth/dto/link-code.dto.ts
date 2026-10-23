import { ApiProperty } from "@nestjs/swagger";

export class LinkCodeView {
  @ApiProperty({ example: "482913", description: "Six digits the owner types on the consent page when linking Alexa or another app." })
  code!: string;

  @ApiProperty({ example: "2026-10-11T18:10:00.000Z", description: "The code stops working after this time." })
  expiresAt!: string;
}
