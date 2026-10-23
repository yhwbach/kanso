import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { useDevices } from "@daily-co/daily-react";
import { Check, ChevronUp, Mic, MicOff, MonitorUp, Video, VideoOff } from "lucide-react";
import { useLocalCamera } from "@/components/cvi/hooks/use-local-camera";
import { useLocalMicrophone } from "@/components/cvi/hooks/use-local-microphone";
import { useLocalScreenshare } from "@/components/cvi/hooks/use-local-screenshare";

const square = "grid h-10 place-items-center bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

function DeviceControl({
  label,
  icon,
  off,
  canToggle,
  onToggle,
  devices,
  currentId,
  onSelect,
}: {
  label: string;
  icon: ReactNode;
  off: boolean;
  canToggle: boolean;
  onToggle: () => void;
  devices: { device: MediaDeviceInfo }[];
  currentId: string | undefined;
  onSelect: (deviceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex gap-px">
      <button
        type="button"
        onClick={onToggle}
        disabled={!canToggle}
        aria-pressed={!off}
        aria-label={off ? `Turn ${label.toLowerCase()} on` : `Turn ${label.toLowerCase()} off`}
        className={`${square} w-10 ${off ? "text-bad" : ""}`}
      >
        {icon}
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={devices.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Choose ${label.toLowerCase()}`}
        className={`${square} w-6`}
      >
        <ChevronUp size={14} className={`transition-transform ${open ? "" : "rotate-180"}`} />
      </button>
      {open && (
        <div role="menu" aria-label={label} className="rise absolute bottom-[calc(100%+8px)] left-0 z-40 w-64 max-w-[80vw] border border-line2 bg-surface text-left">
          <p className="label border-b border-dashed border-line2 px-4 py-2.5 text-ink3">{label}</p>
          {devices.map(({ device }) => {
            const selected = device.deviceId === currentId;
            return (
              <button
                key={device.deviceId}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onSelect(device.deviceId);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors cursor-pointer ${selected ? "bg-ink text-bg" : "text-ink2 hover:bg-bg2 hover:text-ink"}`}
              >
                <span className="min-w-0 flex-1 truncate">{device.label}</span>
                {selected && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const MicSelectBtn = memo(() => {
  const { onToggleMicrophone, isMicReady, isMicMuted } = useLocalMicrophone();
  const { microphones, currentMic, setMicrophone } = useDevices();
  const off = isMicMuted || !isMicReady;
  return (
    <DeviceControl
      label="Microphone"
      icon={off ? <MicOff size={18} /> : <Mic size={18} />}
      off={off}
      canToggle={isMicReady}
      onToggle={onToggleMicrophone}
      devices={microphones}
      currentId={currentMic?.device.deviceId}
      onSelect={(id) => void setMicrophone(id)}
    />
  );
});

MicSelectBtn.displayName = "MicSelectBtn";

const CAMERA_UNAVAILABLE = new Set(["blocked", "in-use", "not-found", "not-supported", "undefined-mediadevices"]);

export const CameraSelectBtn = memo(() => {
  const { onToggleCamera, isCamMuted } = useLocalCamera();
  const { cameras, currentCam, setCamera, camState } = useDevices();
  return (
    <DeviceControl
      label="Camera"
      icon={isCamMuted ? <VideoOff size={18} /> : <Video size={18} />}
      off={isCamMuted}
      canToggle={!CAMERA_UNAVAILABLE.has(camState)}
      onToggle={onToggleCamera}
      devices={cameras}
      currentId={currentCam?.device.deviceId}
      onSelect={(id) => void setCamera(id)}
    />
  );
});

CameraSelectBtn.displayName = "CameraSelectBtn";

export const ScreenShareButton = memo(() => {
  const { onToggleScreenshare, isScreenSharing } = useLocalScreenshare();
  return (
    <button
      type="button"
      onClick={onToggleScreenshare}
      aria-pressed={isScreenSharing}
      aria-label={isScreenSharing ? "Stop sharing your screen" : "Share your screen"}
      className={`${square} w-10 ${isScreenSharing ? "!bg-ink !text-bg" : ""}`}
    >
      <MonitorUp size={18} />
    </button>
  );
});

ScreenShareButton.displayName = "ScreenShareButton";
