import { PhoneOff } from "lucide-react";
import { endConversation } from "@/api/generated/tavus/tavus";
import { useStore } from "@/lib/store";
import { CVIProvider } from "@/components/cvi/components/cvi-provider";
import { Conversation } from "@/components/cvi/components/conversation";
import { MagicCanvas } from "@/components/cvi/components/magic-canvas";

export interface PalConversation {
  id: string;
  url: string;
}

export function PalCard({ conversation, onClose }: { conversation: PalConversation; onClose: () => void }) {
  const toast = useStore((s) => s.toast);
  const leave = () => {
    void endConversation(conversation.id);
    onClose();
  };
  return (
    <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "4 / 3" }}>
      <CVIProvider>
        <div className="relative h-full">
          <Conversation conversationUrl={conversation.url} onLeave={leave} />
          <MagicCanvas className="!absolute" onInteraction={(e) => toast("Card answered", `${e.component} ${e.type}`)} />
        </div>
      </CVIProvider>
      <button
        onClick={leave}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center bg-black/60 text-white hover:bg-bad cursor-pointer"
        aria-label="End conversation"
      >
        <PhoneOff size={14} />
      </button>
    </div>
  );
}
