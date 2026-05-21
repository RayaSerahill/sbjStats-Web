import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function DashboardPageHeader({ title, description, action }: DashboardPageHeaderProps) {
  return (
    <div
      className="flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-start sm:justify-between"
      style={{ borderColor: "var(--dashboard-accent-ring, #ff9fc6)" }}
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type DashboardSectionProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function DashboardSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "p-4",
}: DashboardSectionProps) {
  return (
    <section className={["overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm", className].filter(Boolean).join(" ")}>
      <div
        className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
        style={{
          backgroundColor: "var(--dashboard-accent-soft, #fff7fb)",
          borderColor: "var(--dashboard-accent-ring, #ff9fc6)",
        }}
      >
        <div>
          {eyebrow ? (
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--dashboard-accent, #ff9fc6)" }}>
              {eyebrow}
            </div>
          ) : null}
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
