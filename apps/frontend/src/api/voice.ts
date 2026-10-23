import { http } from "@/api/http";
import { getSendVoiceCommandUrl } from "@/api/generated/commands/commands";
import type { CommandResult } from "@/api/generated/model";

// The generated client JSON-encodes binary bodies, so the WAV upload bypasses it.
export function sendVoiceCommand(wav: Blob, userId: string): Promise<CommandResult> {
  return http<CommandResult>(getSendVoiceCommandUrl({ userId }), { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
}
