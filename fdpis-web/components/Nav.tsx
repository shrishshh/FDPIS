"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, ClipboardList, GitBranch } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ScopeBar } from "@/components/ScopeBar";

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

        <ScopeBar />
      </div>
    </header>
  );
}
