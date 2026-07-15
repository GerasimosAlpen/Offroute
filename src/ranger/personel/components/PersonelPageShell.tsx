import type { ComponentChildren } from "preact";

interface PersonelPageShellProps {
  title: string;
  description?: string;
  children?: ComponentChildren;
}

export function PersonelPageShell({
  title,
  description,
  children,
}: PersonelPageShellProps) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1a1a1a] pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="border-b-2 border-[#333] px-4 py-5 sm:px-8 sm:py-6">
        <h1 className="font-grotesk font-bold text-xl sm:text-2xl text-white tracking-[-0.4px]">
          {title}
        </h1>
        {description && (
          <p className="font-mono text-xs text-[#8a8a8a] mt-1">
            {description}
          </p>
        )}
      </header>
      <div className="p-4 sm:p-8 flex flex-col gap-4">{children}</div>
    </div>
  );
}
