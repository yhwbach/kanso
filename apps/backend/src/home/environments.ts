import type { DeviceType } from "@/home/entities/device.entity";

export interface DeviceSeed {
  deviceId: string;
  name: string;
  room: string;
  type: DeviceType;
  isOn?: boolean;
  locked?: boolean;
  temperature?: number;
  status?: "online" | "offline" | "error";
  hubId?: string;
  aliases?: string[];
}

const shared = {
  frontDoor: { deviceId: "front-door-lock", name: "Front Door Lock", room: "Entrance", type: "lock", locked: true, aliases: ["front door", "door lock", "the door", "door"] } satisfies DeviceSeed,
  backyardHub: { deviceId: "backyard-hub", name: "Backyard Hub", room: "Backyard", type: "hub", status: "offline", aliases: ["outdoor hub", "hub"] } satisfies DeviceSeed,
  backyardLights: { deviceId: "backyard-lights", name: "Backyard Lights", room: "Backyard", type: "light", hubId: "backyard-hub", aliases: ["backyard light", "garden lights", "outdoor lights", "patio lights"] } satisfies DeviceSeed,
  ceilingFan: { deviceId: "ceiling-fan", name: "Ceiling Fan", room: "Living Room", type: "fan", aliases: ["fan", "living room fan"] } satisfies DeviceSeed,
};

export const ENVIRONMENTS: Record<string, { label: string; devices: DeviceSeed[] }> = {
  "modern-apartment": {
    label: "Modern Apartment",
    devices: [
      { deviceId: "living-room-lights", name: "Living Room Lights", room: "Living Room", type: "light", aliases: ["living room light", "lounge lights"] },
      { deviceId: "kitchen-light", name: "Kitchen Light", room: "Kitchen", type: "light", aliases: ["kitchen lights"] },
      { deviceId: "bedroom-lamp", name: "Bedroom Lamp", room: "Bedroom", type: "light", aliases: ["bedroom light", "bedroom lights"] },
      shared.backyardHub,
      shared.backyardLights,
      shared.frontDoor,
      shared.ceilingFan,
      { deviceId: "thermostat", name: "Thermostat", room: "Hallway", type: "thermostat", temperature: 70, aliases: ["temperature", "heating", "ac", "air conditioning"] },
    ],
  },
  "family-house": {
    label: "Family House",
    devices: [
      { deviceId: "living-room-lights", name: "Living Room Lights", room: "Living Room", type: "light", aliases: ["living room light"] },
      { deviceId: "kitchen-light", name: "Kitchen Light", room: "Kitchen", type: "light", aliases: ["kitchen lights"] },
      { deviceId: "kids-room-light", name: "Kids Room Light", room: "Kids Room", type: "light", aliases: ["kids light", "nursery light"] },
      { deviceId: "garage-light", name: "Garage Light", room: "Garage", type: "light", aliases: ["garage lights"] },
      shared.backyardHub,
      shared.backyardLights,
      shared.frontDoor,
      { deviceId: "back-door-lock", name: "Back Door Lock", room: "Kitchen", type: "lock", locked: true, aliases: ["back door"] },
      shared.ceilingFan,
      { deviceId: "thermostat", name: "Thermostat", room: "Hallway", type: "thermostat", temperature: 68, aliases: ["temperature", "heating", "ac"] },
    ],
  },
  "studio-loft": {
    label: "Studio Loft",
    devices: [
      { deviceId: "main-lights", name: "Main Lights", room: "Studio", type: "light", aliases: ["lights", "studio lights", "living room lights"] },
      { deviceId: "desk-lamp", name: "Desk Lamp", room: "Studio", type: "light", aliases: ["desk light", "lamp"] },
      { deviceId: "kitchen-light", name: "Kitchen Light", room: "Kitchenette", type: "light", aliases: ["kitchen lights"] },
      { ...shared.backyardHub, name: "Balcony Hub", room: "Balcony", aliases: ["outdoor hub", "backyard hub", "hub"] },
      { ...shared.backyardLights, name: "Balcony Lights", room: "Balcony", aliases: ["backyard lights", "outdoor lights", "balcony light"] },
      shared.frontDoor,
      { ...shared.ceilingFan, room: "Studio" },
      { deviceId: "thermostat", name: "Thermostat", room: "Studio", type: "thermostat", temperature: 71, aliases: ["temperature", "heating", "ac"] },
    ],
  },
};
