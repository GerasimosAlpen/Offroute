export default function PersonelPage() {
  return (
    <div class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
      <div class="max-w-md text-center flex flex-col gap-2">
        <h1 class="text-sm font-semibold text-white">Personel — blocked</h1>
        <p class="text-xs text-zinc-500">
          Spec calls for a phone version, but this app targets Tauri desktop.
          Platform decision (separate mobile build vs. web view) needed
          before this page is built — see the open question in CLAUDE.md.
        </p>
      </div>
    </div>
  );
}
