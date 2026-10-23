import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "kanso.theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolvedTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolvedTheme(read()));
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      /* private mode */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolved(resolvedTheme(theme));
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme]);
  const toggle = useCallback(() => setThemeState(resolved === "dark" ? "light" : "dark"), [resolved]);
  return { theme, resolved, setTheme: setThemeState, toggle };
}
