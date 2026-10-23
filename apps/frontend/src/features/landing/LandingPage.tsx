import { Link } from "react-router-dom";
import { ArrowRight, Github, Moon, Sun } from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { useTheme } from "@/lib/theme";

const points = [
  { title: "Answers before you finish asking", body: "Your words are understood on your own machine. No round trip, no spinner." },
  {
    title: "Nothing to leak",
    body: "Names, numbers and addresses are hidden before anything is saved. The privacy page shows you exactly what left the house.",
  },
  { title: "Shows, doesn't lecture", body: "When something breaks, you get a card with a button, not a speech." },
  { title: "Builds what you describe", body: "Say what you want automated. Kanso writes it, checks it and keeps it ready." },
];

export function LandingPage() {
  const { resolved, toggle } = useTheme();
  return (
    <div className="min-h-full bg-bg">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Switch theme"
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink2 hover:text-ink cursor-pointer"
          >
            {resolved === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <a href="https://github.com/yhwbach/kanso" target="_blank" rel="noreferrer" className="btn ghost px-3 sm:px-[18px]" aria-label="Source on GitHub">
            <Github size={14} /> <span className="hidden sm:inline">Source</span>
          </a>
          <Link to="/app" className="btn primary">
            Try it <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <section className="stagger mx-auto max-w-[1200px] px-6 pb-16 pt-10 sm:pb-20 sm:pt-16 md:pt-28">
        <span className="label">A quieter way to run a home</span>
        <h1 className="display mt-6 max-w-[12ch] text-[clamp(48px,11vw,128px)]">Say it. It's done.</h1>
        <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-ink2 sm:mt-8 sm:text-[19px]">
          Kanso listens on your own machine, keeps what you say at home, and does what you ask in the time it takes to blink.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/app" className="btn primary h-13 px-7 text-[14px]">
            Try the demo <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 px-6 pb-24 md:grid-cols-2">
        {points.map((p, i) => (
          <article key={p.title} className={`tile p-8 ${i === 0 ? "on" : ""}`}>
            <span className={`led ${i === 0 ? "on" : ""}`} />
            <h2 className="mt-6 text-[26px] font-bold tracking-[-0.03em]">{p.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink2">{p.body}</p>
          </article>
        ))}
      </section>

      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 pb-12">
        <span className="label">Kanso</span>
        <span className="label">Works with Alexa</span>
      </footer>
    </div>
  );
}
