"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, BellRing, ClipboardList, GitBranch } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ScopeBar } from "@/components/ScopeBar";

const LINKS = [
  { href: "/briefing", label: "Briefing", icon: ClipboardList },
  { href: "/cascade", label: "Cascade", icon: GitBranch },
  { href: "/live", label: "Live", icon: Activity },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/performance", label: "Performance", icon: BarChart3 },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      {/* Below lg the header wraps: logo + scope controls on the first row, the
          nav on a second row that scrolls sideways inside itself, so the page
          never scrolls horizontally on a phone. */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-2 sm:px-5 lg:h-16 lg:flex-nowrap lg:px-8 lg:pt-0">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="FDPIS home">
          <Logo />
        </Link>

        <nav
          className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-2 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:overflow-visible lg:px-0 lg:pb-0"
          aria-label="Primary"
        >
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-accent-50 text-accent-700"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <ScopeBar />
      </div>
    </header>
  );
}
