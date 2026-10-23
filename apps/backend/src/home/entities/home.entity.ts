import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type HomeDocument = HydratedDocument<Home>;

@Schema({ collection: "homes", timestamps: { createdAt: true, updatedAt: false } })
export class Home {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true })
  template!: string;

  /** An SVG the user uploaded. When empty the client draws one from the name. */
  @Prop()
  icon?: string;

  createdAt?: Date;
}

export const HomeSchema = SchemaFactory.createForClass(Home);
