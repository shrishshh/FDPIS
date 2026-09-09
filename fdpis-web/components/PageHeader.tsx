export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-ink-200 bg-white px-5 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-8">
      <div className="max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 lg:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}
