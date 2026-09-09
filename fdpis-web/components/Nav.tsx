"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, ClipboardList, GitBranch } from "lucide-react";
import { Logo } from "@/components/Logo";
import { USING_MOCK_DATA } from "@/lib/api";

const LINKS = [
  { href: "/briefing", label: "Briefing", icon: ClipboardList },
  { href: "/cascade", label: "Cascade", icon: GitBranch },
  { href: "/live", label: "Live", icon: Activity },
  { href: "/performance", label: "Performance", icon: BarChart3 },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-5 lg:px-8">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="FDPIS home">
          <Logo />
        </Link>

        <nav className="flex flex-1 items-center gap-1" aria-label="Primary">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
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

        {USING_MOCK_DATA ? (
          <span
            title="All figures on screen are generated fixtures, not a live operational feed."
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ink-400" aria-hidden />
            Demo data
          </span>
        ) : null}
      </div>
    </header>
  );
}
