import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type OAuthTokenKind = "access" | "refresh";
export type OAuthTokenDocument = HydratedDocument<OAuthToken>;

/** Only a SHA-256 of each token is stored, so a copy of the database cannot be used to call tools. */
@Schema({ collection: "oauth_tokens", timestamps: true })
export class OAuthToken {
  @Prop({ required: true, unique: true })
  hash!: string;

  @Prop({ type: String, required: true })
  kind!: OAuthTokenKind;

  @Prop({ required: true, index: true })
  clientId!: string;

  @Prop({ required: true })
  scope!: string;

  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;
}

export const OAuthTokenSchema = SchemaFactory.createForClass(OAuthToken);
