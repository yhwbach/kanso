import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type DeviceStatus = "online" | "offline" | "error";
export type DeviceType = "light" | "lock" | "thermostat" | "fan" | "hub" | "speaker";
export type DeviceDocument = HydratedDocument<Device>;

@Schema({ collection: "device_states", timestamps: true })
export class Device {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Home", required: true, index: true })
  homeId!: Types.ObjectId;

  @Prop({ required: true })
  deviceId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  room!: string;

  @Prop({ type: String, required: true })
  type!: DeviceType;

  @Prop({ type: String, default: "online" })
  status!: DeviceStatus;

  @Prop({ default: false })
  isOn!: boolean;

  @Prop({ default: false })
  locked!: boolean;

  @Prop()
  temperature?: number;

  @Prop()
  hubId?: string;

  @Prop({ type: [String], default: [] })
  aliases!: string[];
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
DeviceSchema.index({ homeId: 1, deviceId: 1 }, { unique: true });
