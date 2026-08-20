import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Section({
  title,
  kicker,
  href,
  children,
  className,
}: {
  title: string;
  kicker?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          {kicker && (
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">{kicker}</p>
          )}
          <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
        </div>
        {href && (
          <Link to={href} className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
            View all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
