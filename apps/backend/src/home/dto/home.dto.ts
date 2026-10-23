import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { CONNECTED_KINDS, type ConnectedKind } from "@/home/entities/connected-device.entity";

export class EnvironmentView {
  @ApiProperty({ example: "modern-apartment" })
  key!: string;

  @ApiProperty({ example: "Modern Apartment" })
  label!: string;

  @ApiProperty({ example: 8 })
  deviceCount!: number;
}

export class OnboardRequest {
  @ApiProperty({ example: "Alex", description: "What Kanso should call the user." })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiProperty({ example: "Modern Apartment", description: "The name of the first home." })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  homeName!: string;

  @ApiProperty({ example: "modern-apartment", description: "One of the keys from GET /api/environments. Decides which devices the home starts with." })
  @IsString()
  template!: string;

  @ApiPropertyOptional({ default: true, description: "Mask names, numbers and addresses on this machine before a command is stored or routed." })
  @IsOptional()
  @IsBoolean()
  privacyEnabled?: boolean;
}

export class UserView {
  @ApiProperty({ example: "66f1c2a5f0a1b2c3d4e5f607" })
  id!: string;

  @ApiProperty({ example: "Alex" })
  name!: string;

  @ApiProperty()
  privacyEnabled!: boolean;

  @ApiProperty({ description: "The home commands apply to." })
  activeHomeId!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
}

export class HomeView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: "Lake Cabin" })
  name!: string;

  @ApiProperty({ example: "family-house" })
  template!: string;

  @ApiPropertyOptional({ description: "An SVG the user chose. When empty the app draws one from the name." })
  icon?: string;

  @ApiProperty()
  deviceCount!: number;

  @ApiProperty()
  connectedCount!: number;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
}

export class CreateHomeRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: "Lake Cabin" })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ example: "family-house", description: "Which devices to start with. Defaults to a layout guessed from the name." })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiPropertyOptional({ description: "An SVG for the home's icon. Leave empty to get a generated one." })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  icon?: string;
}

export class UpdateHomeRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: "Lake Cabin" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @ApiPropertyOptional({ description: "Send an empty string to go back to the generated icon." })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  icon?: string;
}

export class ConnectedDeviceView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: CONNECTED_KINDS })
  kind!: ConnectedKind;

  @ApiProperty({ example: "Kitchen Echo Show" })
  name!: string;

  @ApiPropertyOptional({ example: "Kitchen" })
  room?: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
}

export class ConnectDeviceRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ enum: CONNECTED_KINDS })
  @IsIn(CONNECTED_KINDS as unknown as string[])
  kind!: ConnectedKind;

  @ApiProperty({ example: "Kitchen Echo Show" })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ example: "Kitchen" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  room?: string;
}

export class DeviceStateView {
  @ApiProperty({ example: "living-room-lights" })
  id!: string;

  @ApiProperty({ example: "Living Room Lights" })
  name!: string;

  @ApiProperty({ example: "Living Room" })
  room!: string;

  @ApiProperty({ enum: ["light", "lock", "thermostat", "fan", "hub", "speaker"] })
  type!: "light" | "lock" | "thermostat" | "fan" | "hub" | "speaker";

  @ApiProperty({ enum: ["online", "offline", "error"] })
  status!: "online" | "offline" | "error";

  @ApiProperty()
  isOn!: boolean;

  @ApiProperty({ description: "Only meaningful for locks." })
  locked!: boolean;

  @ApiPropertyOptional({ description: "Target temperature in Fahrenheit. Only on thermostats." })
  temperature?: number;

  @ApiPropertyOptional({ example: "backyard-hub", description: "The hub this device depends on." })
  hubId?: string;
}

export class TimerView {
  @ApiProperty({ example: "t_m1x9k2ab" })
  id!: string;

  @ApiProperty({ example: "Timer" })
  label!: string;

  @ApiProperty({ example: 900000 })
  durationMs!: number;

  @ApiProperty({ format: "date-time" })
  endsAt!: string;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;
}

export class HomeSnapshot {
  @ApiProperty({ type: UserView })
  user!: UserView;

  @ApiProperty({ type: [HomeView] })
  homes!: HomeView[];

  @ApiProperty({ type: HomeView })
  activeHome!: HomeView;

  @ApiProperty({ type: [DeviceStateView] })
  devices!: DeviceStateView[];

  @ApiProperty({ type: [ConnectedDeviceView] })
  connected!: ConnectedDeviceView[];

  @ApiProperty({ type: [TimerView] })
  timers!: TimerView[];
}

export class ActionResultView {
  @ApiProperty()
  ok!: boolean;

  @ApiPropertyOptional({ enum: ["DEVICE_NOT_FOUND", "HUB_OFFLINE", "UNSUPPORTED"] })
  error?: "DEVICE_NOT_FOUND" | "HUB_OFFLINE" | "UNSUPPORTED";

  @ApiProperty({ example: "Living Room Lights on.", description: "Short enough to speak aloud." })
  message!: string;

  @ApiPropertyOptional({ type: DeviceStateView })
  device?: DeviceStateView;

  @ApiPropertyOptional({ type: DeviceStateView, description: "The offline hub when error is HUB_OFFLINE." })
  hub?: DeviceStateView;

  @ApiPropertyOptional({ type: [DeviceStateView], description: "Closest matches when error is DEVICE_NOT_FOUND." })
  candidates?: DeviceStateView[];
}

export class SetPowerRequest {
  @ApiPropertyOptional({ description: "Defaults to the most recently onboarded user." })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty()
  @IsBoolean()
  on!: boolean;
}

export class SetLockRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty()
  @IsBoolean()
  locked!: boolean;
}

export class RestartHubRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: "backyard-hub", description: "Defaults to the home's first hub." })
  @IsOptional()
  @IsString()
  hubId?: string;
}

export class RestartHubResponse {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty({ type: DeviceStateView })
  hub!: DeviceStateView;

  @ApiProperty({ type: [DeviceStateView], description: "Devices whose pending command was replayed once the hub came back." })
  applied!: DeviceStateView[];

  @ApiProperty({ example: "Hub restarted. Backyard Lights on." })
  message!: string;
}

export class CreateTimerRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: 900000, minimum: 1000 })
  @IsInt()
  @Min(1000)
  durationMs!: number;

  @ApiPropertyOptional({ example: "Pasta" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;
}

export class UserIdRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}

export class OkResponse {
  @ApiProperty()
  ok!: boolean;
}
