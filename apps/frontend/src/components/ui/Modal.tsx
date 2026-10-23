import type { ReactNode } from "react";

export function Modal({ children, width = "max-w-xl", onClose }: { children: ReactNode; width?: string; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/50 p-3 backdrop-blur-[2px] sm:p-4" onClick={onClose}>
      <div className={`rise panel w-full ${width} overflow-hidden bg-surface`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
