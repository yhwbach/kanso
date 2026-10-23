import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type OAuthClientDocument = HydratedDocument<OAuthClient>;

@Schema({ collection: "oauth_clients", timestamps: true })
export class OAuthClient {
  @Prop({ required: true, unique: true })
  clientId!: string;

  @Prop()
  clientName?: string;

  @Prop({ type: [String], default: [] })
  redirectUris!: string[];
}

export const OAuthClientSchema = SchemaFactory.createForClass(OAuthClient);
