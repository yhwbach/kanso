import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useRealtime } from "@/lib/realtime";
import { TopBar } from "@/features/shell/TopBar";
import { OnboardingModal } from "@/features/onboarding/OnboardingModal";
import { HomeView } from "@/features/home/HomeView";
import { PrivacyView } from "@/features/privacy/PrivacyView";
import { AutomationsView } from "@/features/developer/AutomationsView";
import { NewHomeModal, ConnectDeviceModal, EditHomeModal } from "@/features/home/HomeModals";
import { CommandBar } from "@/features/home/CommandBar";
import { Toasts } from "@/components/ui/Toasts";

export function AppShell() {
  const booted = useStore((s) => s.booted);
  const user = useStore((s) => s.user);
  const view = useStore((s) => s.view);
  const modal = useStore((s) => s.modal);
  const lastCommand = useStore((s) => s.lastCommand);
  const boot = useStore((s) => s.boot);
  useEffect(() => {
    void boot();
  }, [boot]);
  useRealtime(user?.id);

  return (
    <div className="min-h-full bg-bg">
      <TopBar />
      <main className="mx-auto max-w-[1320px] px-4 pb-56 sm:px-6 md:px-12">
        {user && view === "home" && <HomeView />}
        {user && view === "privacy" && <PrivacyView key={lastCommand?.logId} />}
        {user && view === "automations" && <AutomationsView />}
      </main>
      {user && <CommandBar />}
      {booted && !user && <OnboardingModal />}
      {modal === "new-home" && <NewHomeModal />}
      {modal === "edit-home" && <EditHomeModal />}
      {modal === "connect-device" && <ConnectDeviceModal />}
      <Toasts />
    </div>
  );
}
