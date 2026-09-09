export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden
        className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
          <circle cx="5" cy="12" r="2.6" fill="#ffffff" />
          <circle cx="13" cy="7" r="2.1" fill="#ffffff" fillOpacity="0.85" />
          <circle cx="13" cy="17" r="2.1" fill="#ffffff" fillOpacity="0.85" />
          <circle cx="20" cy="12" r="1.7" fill="#ffffff" fillOpacity="0.55" />
          <path
            d="M7.4 11 11 8m-3.6 5 3.6 3m4 -1.6 3.2 -1.6m-3.2 -3.4 3.2 1.6"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="text-[0.95rem] font-bold tracking-tight text-ink-900">
        FDPIS
      </span>
    </span>
  );
}
