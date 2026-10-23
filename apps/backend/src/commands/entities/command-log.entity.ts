import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type CommandLogDocument = HydratedDocument<CommandLog>;

@Schema({ collection: "command_logs", timestamps: { createdAt: "timestamp", updatedAt: false } })
export class CommandLog {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  rawText!: string;

  @Prop({ required: true })
  sanitizedText!: string;

  @Prop({ default: false })
  piiDetected!: boolean;

  @Prop({ type: [String], default: [] })
  piiLabels!: string[];

  @Prop({ type: [String], default: [] })
  topics!: string[];

  @Prop({ type: String, default: "local" })
  source!: "local" | "pal";

  @Prop({ type: Object, default: {} })
  latency!: Record<string, number>;

  @Prop({ type: [Object], default: [] })
  actions!: Record<string, unknown>[];

  @Prop({ default: "" })
  reply!: string;

  @Prop({ type: [Object], default: [] })
  telemetry!: Record<string, string>[];

  @Prop({ default: false })
  cloudEgress!: boolean;

  timestamp?: Date;
}

export const CommandLogSchema = SchemaFactory.createForClass(CommandLog);
