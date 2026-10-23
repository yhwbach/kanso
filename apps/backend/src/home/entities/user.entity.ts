import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: "users", timestamps: { createdAt: true, updatedAt: false } })
export class User {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: true })
  privacyEnabled!: boolean;

  @Prop({ type: Types.ObjectId, ref: "Home" })
  activeHomeId?: Types.ObjectId;

  createdAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
