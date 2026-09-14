"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { WalletButton } from "@/components/mint/WalletButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RedbellyMark } from "@/components/ui/RedbellyMark";
import { collection } from "@/lib/collection";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Collection", href: "#collection" },
  { label: "Watches", href: "#watches" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Why Redbelly", href: "#why-redbelly" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-colors duration-200",
        scrolled
          ? "border-rb-border bg-rb-bg/90 backdrop-blur-sm"
          : "border-transparent bg-transparent",
      )}
    >
      <nav className="rb-container flex h-16 items-center justify-between gap-4" aria-label="Main">
        <a href="#top" className="flex items-center gap-2.5 font-display font-bold">
          <RedbellyMark className="h-7 w-7" />
          <span className="text-rb-ink">{collection.name}</span>
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-rb-muted transition-colors hover:bg-rb-bg-alt hover:text-rb-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:block">
            <WalletButton />
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg p-2 text-rb-ink lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-rb-border bg-rb-bg lg:hidden">
          <ul className="rb-container space-y-1 py-4">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-rb-ink transition-colors hover:bg-rb-bg-alt"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <WalletButton className="w-full" />
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
