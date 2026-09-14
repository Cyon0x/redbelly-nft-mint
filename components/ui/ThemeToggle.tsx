"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * The theme attribute is owned by the document, not React — a plain useState copy
 * would desync (tab restore, dev fast refresh, another tab changing the theme).
 * Subscribe to it directly.
 */
function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light" as const,
  );

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rb-theme", next);
    } catch {
      /* storage can be unavailable; the toggle still works for this session */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg p-2 text-rb-muted transition-colors hover:bg-rb-bg-alt hover:text-rb-ink"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
