import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OAuthClient, OAuthClientSchema } from "@/oauth/entities/oauth-client.entity";
import { OAuthToken, OAuthTokenSchema } from "@/oauth/entities/oauth-token.entity";
import { OAuthService } from "@/oauth/services/oauth.service";
import { OAuthController } from "@/oauth/oauth.controller";
import { LinkCodeController } from "@/oauth/link-code.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OAuthClient.name, schema: OAuthClientSchema },
      { name: OAuthToken.name, schema: OAuthTokenSchema },
    ]),
  ],
  providers: [OAuthService],
  controllers: [OAuthController, LinkCodeController],
  exports: [OAuthService],
})
export class OAuthModule {}
