export function Panel({
  icon,
  title,
  children,
}: {
  icon: preact.ComponentChildren;
  title: string;
  children: preact.ComponentChildren;
}) {
  return (
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <div class="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">{icon}</div>
        <span class="text-sm font-semibold text-white">{title}</span>
      </div>
      {children}
    </div>
  );
}
