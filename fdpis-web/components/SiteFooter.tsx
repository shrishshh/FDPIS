import { Github } from "lucide-react";

export const REPO_URL = "https://github.com/shrishshh/FDPIS";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-200 bg-ink-50/60">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-5 py-6 text-xs leading-relaxed text-ink-500 lg:px-8">
        <p className="max-w-3xl">
          <span className="font-semibold text-ink-700">Research prototype.</span> US BTS
          on-time data, Jan/Apr/Jul 2025. Not an operational system. Crew alerts use a
          hypothetical one-crew-per-aircraft model; notifications are simulated.
        </p>
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <p>
            Team: Shrish Singh Sourya, Ashish Pathak, Ssunavya Jain &middot; Guide: Prof.
            Anuradha G. &middot; VIT Vellore
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-accent-700 hover:text-accent-800"
          >
            <Github className="h-3.5 w-3.5" aria-hidden />
            Source on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
