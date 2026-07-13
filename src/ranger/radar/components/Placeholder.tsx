export function Placeholder({ label }: { label: string }) {
  return (
    <p class="text-xs font-mono text-zinc-600 border border-dashed border-zinc-800 rounded-lg px-3 py-4 text-center">
      {label}
    </p>
  );
}
