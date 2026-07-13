export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      class={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${color}`}
    >
      {label}
    </span>
  );
}
