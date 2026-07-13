import type { ComponentChildren } from "preact";

interface RadarPageShellProps {
  title: string;
  description?: string;
  children?: ComponentChildren;
}

/** Shared header/frame for every radar console page — keeps title placement and page identity consistent. */
export function RadarPageShell({
  title,
  description,
  children,
}: RadarPageShellProps) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1a1a1a]">
      <header className="border-b-2 border-[#333] px-8 py-6">
        <h1 className="font-grotesk font-bold text-2xl text-white tracking-[-0.4px]">
          {title}
        </h1>
        {description && (
          <p className="font-mono text-xs text-[#8a8a8a] mt-1">
            {description}
          </p>
        )}
      </header>
      <div className="p-8 flex flex-col gap-4">{children}</div>
    </div>
  );
}
