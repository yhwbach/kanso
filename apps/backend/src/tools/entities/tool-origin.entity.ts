import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ToolOriginDocument = HydratedDocument<ToolOrigin>;

/** How a generated extension came to be. The file itself stays the source of truth for the tool. */
@Schema({ collection: "tool_origins", timestamps: true })
export class ToolOrigin {
  @Prop({ required: true, unique: true })
  fileName!: string;

  @Prop()
  intent?: string;

  @Prop()
  engine?: string;

  /** Whose home a scheduled run acts on. */
  @Prop()
  userId?: string;
}

export const ToolOriginSchema = SchemaFactory.createForClass(ToolOrigin);
