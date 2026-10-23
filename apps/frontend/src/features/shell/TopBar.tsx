import { Moon, Plus, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { Wordmark } from "@/components/ui/Wordmark";
import { HomeIcon } from "@/components/ui/HomeIcon";
import { Avatar } from "@/components/ui/Avatar";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";

export function TopBar() {
  const user = useStore((s) => s.user);
  const homes = useStore((s) => s.homes);
  const activeHome = useStore((s) => s.activeHome);
  const switchHome = useStore((s) => s.switchHome);
  const openModal = useStore((s) => s.openModal);
  const signOut = useStore((s) => s.signOut);
  const { resolved, toggle } = useTheme();

  const homeStrip = user && (
    <div className="flex items-center gap-2">
      {homes.map((h) => (
        <button
          key={h.id}
          onClick={() => void switchHome(h.id)}
          className={`chip h-[38px] shrink-0 ${h.id === activeHome?.id ? "active" : ""}`}
          title={`${h.deviceCount} devices`}
        >
          <HomeIcon name={h.name} icon={h.icon} size={18} />
          {h.name}
        </button>
      ))}
      <button
        onClick={() => openModal("new-home")}
        aria-label="New home"
        className="chip dashed h-[38px] w-[38px] shrink-0 justify-center !px-0 sm:w-auto sm:!pl-2 sm:!pr-3"
      >
        <Plus size={14} /> <span className="hidden sm:inline">New home</span>
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 md:px-12">
        <Link to="/" aria-label="Kanso">
          <Wordmark />
        </Link>

        {user && <div className="hidden lg:flex">{homeStrip}</div>}

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Switch theme"
            className="grid h-9 w-9 shrink-0 place-items-center border border-line bg-surface text-ink2 hover:text-ink cursor-pointer"
          >
            {resolved === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {user && (
            <button onClick={signOut} title="Switch person" aria-label="Switch person" className="flex cursor-pointer">
              <Avatar name={user.name} size={36} />
            </button>
          )}
        </div>
      </div>
      {user && <div className="scrollbar-thin flex overflow-x-auto px-4 pb-3 sm:px-6 lg:hidden">{homeStrip}</div>}
    </header>
  );
}
