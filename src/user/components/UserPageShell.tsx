import type { ComponentChildren } from "preact";

interface UserPageShellProps {
  title: string;
  description?: string;
  children?: ComponentChildren;
  /** Optional right-aligned action slot in the header bar */
  action?: ComponentChildren;
}

/**
 * Shared header/frame for every user (citizen) mobile page — keeps title
 * placement and visual identity consistent, styled like RadarPageShell but
 * optimised for mobile viewports with bottom-nav clearance.
 */
export function UserPageShell({
  title,
  description,
  children,
  action,
}: UserPageShellProps) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#131313] pb-20">
      <header className="border-b-2 border-[#444] px-4 py-3 flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h1 className="font-grotesk font-bold text-xl text-[#e5e2e1] tracking-[-0.4px] truncate">
            {title}
          </h1>
          {description && (
            <p className="font-mono text-[10px] text-[#8a8a8a] mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="p-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}
