import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export const CONNECTED_KINDS = ["echo-show", "echo-dot", "echo-studio", "echo-hub", "fire-tv", "hue-bridge", "other"] as const;
export type ConnectedKind = (typeof CONNECTED_KINDS)[number];
export type ConnectedDeviceDocument = HydratedDocument<ConnectedDevice>;

@Schema({ collection: "connected_devices", timestamps: { createdAt: true, updatedAt: false } })
export class ConnectedDevice {
  @Prop({ type: Types.ObjectId, ref: "Home", required: true, index: true })
  homeId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  kind!: ConnectedKind;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop()
  room?: string;

  createdAt?: Date;
}

export const ConnectedDeviceSchema = SchemaFactory.createForClass(ConnectedDevice);
