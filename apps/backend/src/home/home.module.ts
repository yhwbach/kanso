import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "@/home/entities/user.entity";
import { Home, HomeSchema } from "@/home/entities/home.entity";
import { Device, DeviceSchema } from "@/home/entities/device.entity";
import { ConnectedDevice, ConnectedDeviceSchema } from "@/home/entities/connected-device.entity";
import { HomeService } from "@/home/services/home.service";
import { HomeTools } from "@/home/tools/home.tools";
import { HomeController } from "@/home/home.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Home.name, schema: HomeSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: ConnectedDevice.name, schema: ConnectedDeviceSchema },
    ]),
  ],
  providers: [HomeService, HomeTools],
  controllers: [HomeController],
  exports: [HomeService],
})
export class HomeModule {}
