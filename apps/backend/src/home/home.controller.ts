import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiErrorResponse } from "@/platform/http/api-error";
import { HomeService } from "@/home/services/home.service";
import { ENVIRONMENTS } from "@/home/environments";
import {
  ActionResultView,
  ConnectDeviceRequest,
  ConnectedDeviceView,
  CreateHomeRequest,
  CreateTimerRequest,
  DeviceStateView,
  EnvironmentView,
  HomeSnapshot,
  HomeView,
  OkResponse,
  OnboardRequest,
  RestartHubRequest,
  RestartHubResponse,
  SetLockRequest,
  SetPowerRequest,
  TimerView,
  UpdateHomeRequest,
  UserIdRequest,
} from "@/home/dto/home.dto";

@ApiTags("home")
@Controller("api")
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get("environments")
  @ApiOperation({ operationId: "listEnvironments", summary: "The starter layouts a new home can begin with." })
  @ApiOkResponse({ type: [EnvironmentView] })
  environments(): EnvironmentView[] {
    return Object.entries(ENVIRONMENTS).map(([key, v]) => ({ key, label: v.label, deviceCount: v.devices.length }));
  }

  @Post("onboard")
  @ApiOperation({ operationId: "onboard", summary: "Create a user and their first home.", description: "There is no password. The returned user id is the only credential the web app needs." })
  @ApiOkResponse({ type: HomeSnapshot })
  onboard(@Body() body: OnboardRequest): Promise<HomeSnapshot> {
    return this.home.onboard({ name: body.name, homeName: body.homeName, template: body.template, privacyEnabled: body.privacyEnabled ?? true });
  }

  @Get("users/:id")
  @ApiOperation({ operationId: "getHome", summary: "Load a user with their homes, the active home's devices, connected devices and timers.", description: "Also marks this user as the active one for MCP tool calls that do not carry a user id." })
  @ApiOkResponse({ type: HomeSnapshot })
  @ApiNotFoundResponse({ type: ApiErrorResponse })
  async snapshot(@Param("id") id: string): Promise<HomeSnapshot> {
    await this.home.setActiveUser(id);
    return this.home.snapshot(id);
  }

  @Get("homes")
  @ApiOperation({ operationId: "listHomes", summary: "Every home the user has." })
  @ApiQuery({ name: "userId", required: false })
  @ApiOkResponse({ type: [HomeView] })
  async homes(@Query("userId") userId?: string): Promise<HomeView[]> {
    return this.home.listHomes(await this.home.resolveUserId(userId));
  }

  @Post("homes")
  @ApiOperation({ operationId: "createHome", summary: "Add a home. It becomes the active one." })
  @ApiOkResponse({ type: HomeView })
  async createHome(@Body() body: CreateHomeRequest): Promise<HomeView> {
    return this.home.createHome(await this.home.resolveUserId(body.userId), { name: body.name, template: body.template, icon: body.icon });
  }

  @Patch("homes/:homeId")
  @ApiOperation({ operationId: "updateHome", summary: "Rename a home or change its icon." })
  @ApiOkResponse({ type: HomeView })
  async updateHome(@Param("homeId") homeId: string, @Body() body: UpdateHomeRequest): Promise<HomeView> {
    return this.home.updateHome(await this.home.resolveUserId(body.userId), homeId, { name: body.name, icon: body.icon });
  }

  @Delete("homes/:homeId")
  @ApiOperation({ operationId: "deleteHome", summary: "Remove a home and everything in it." })
  @ApiQuery({ name: "userId", required: false })
  @ApiOkResponse({ type: OkResponse })
  async deleteHome(@Param("homeId") homeId: string, @Query("userId") userId?: string): Promise<OkResponse> {
    return this.home.deleteHome(await this.home.resolveUserId(userId), homeId);
  }

  @Post("homes/:homeId/activate")
  @ApiOperation({ operationId: "activateHome", summary: "Make this the home that commands apply to." })
  @ApiOkResponse({ type: HomeSnapshot })
  async activate(@Param("homeId") homeId: string, @Body() body: UserIdRequest): Promise<HomeSnapshot> {
    const userId = await this.home.resolveUserId(body.userId);
    await this.home.setActiveHome(userId, homeId);
    return this.home.snapshot(userId);
  }

  @Get("homes/:homeId/connected")
  @ApiOperation({ operationId: "listConnectedDevices", summary: "The Alexa and hub devices linked to a home." })
  @ApiQuery({ name: "userId", required: false })
  @ApiOkResponse({ type: [ConnectedDeviceView] })
  async connected(@Param("homeId") homeId: string, @Query("userId") userId?: string): Promise<ConnectedDeviceView[]> {
    return this.home.listConnected(await this.home.resolveUserId(userId), homeId);
  }

  @Post("homes/:homeId/connected")
  @ApiOperation({ operationId: "connectDevice", summary: "Link an Alexa or hub device to a home." })
  @ApiOkResponse({ type: ConnectedDeviceView })
  async connect(@Param("homeId") homeId: string, @Body() body: ConnectDeviceRequest): Promise<ConnectedDeviceView> {
    return this.home.connectDevice(await this.home.resolveUserId(body.userId), homeId, { kind: body.kind, name: body.name, room: body.room });
  }

  @Delete("homes/:homeId/connected/:connectedId")
  @ApiOperation({ operationId: "disconnectDevice", summary: "Unlink a device from a home." })
  @ApiQuery({ name: "userId", required: false })
  @ApiOkResponse({ type: OkResponse })
  async disconnect(@Param("homeId") homeId: string, @Param("connectedId") connectedId: string, @Query("userId") userId?: string): Promise<OkResponse> {
    return this.home.disconnectDevice(await this.home.resolveUserId(userId), homeId, connectedId);
  }

  @Get("devices")
  @ApiOperation({ operationId: "listDevices", summary: "Devices in the active home." })
  @ApiQuery({ name: "userId", required: false })
  @ApiOkResponse({ type: [DeviceStateView] })
  async devices(@Query("userId") userId?: string): Promise<DeviceStateView[]> {
    return this.home.listDevices(await this.home.resolveUserId(userId));
  }

  @Post("devices/:deviceId/power")
  @ApiOperation({ operationId: "setDevicePower", summary: "Turn a device on or off." })
  @ApiOkResponse({ type: ActionResultView })
  async power(@Param("deviceId") deviceId: string, @Body() body: SetPowerRequest): Promise<ActionResultView> {
    return this.home.setPower(await this.home.resolveUserId(body.userId), deviceId, body.on);
  }

  @Post("devices/:deviceId/lock")
  @ApiOperation({ operationId: "setDeviceLock", summary: "Lock or unlock a lock." })
  @ApiOkResponse({ type: ActionResultView })
  async lock(@Param("deviceId") deviceId: string, @Body() body: SetLockRequest): Promise<ActionResultView> {
    return this.home.setLock(await this.home.resolveUserId(body.userId), deviceId, body.locked);
  }

  @Post("devices/restart")
  @ApiOperation({ operationId: "restartHub", summary: "Restart an offline hub and replay the commands it blocked." })
  @ApiOkResponse({ type: RestartHubResponse })
  async restart(@Body() body: RestartHubRequest) {
    return this.home.restartHub(await this.home.resolveUserId(body.userId), body.hubId ?? "hub");
  }

  @Get("timers")
  @ApiOperation({ operationId: "listTimers", summary: "Running timers for a user." })
  @ApiQuery({ name: "userId", required: false })
  @ApiOkResponse({ type: [TimerView] })
  async timers(@Query("userId") userId?: string): Promise<TimerView[]> {
    return this.home.listTimers(await this.home.resolveUserId(userId));
  }

  @Post("timers")
  @ApiOperation({ operationId: "createTimer", summary: "Start a countdown timer." })
  @ApiOkResponse({ type: TimerView })
  async createTimer(@Body() body: CreateTimerRequest): Promise<TimerView> {
    return this.home.createTimer(await this.home.resolveUserId(body.userId), body.durationMs, body.label);
  }

  @Post("timers/:timerId/cancel")
  @ApiOperation({ operationId: "cancelTimer", summary: "Cancel a running timer." })
  @ApiOkResponse({ type: OkResponse })
  async cancelTimer(@Param("timerId") timerId: string, @Body() body: UserIdRequest): Promise<OkResponse> {
    return { ok: this.home.cancelTimer(await this.home.resolveUserId(body.userId), timerId) };
  }
}
