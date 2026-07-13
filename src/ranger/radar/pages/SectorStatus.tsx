import { RadarPageShell } from "../components/RadarPageShell";
import { Placeholder } from "../components/Placeholder";

export function SectorStatus() {
  return (
    <RadarPageShell
      title="Sector Status"
      description="Node health, hardware status, and coverage overview."
    >
      <Placeholder label="Sector overview grid — not wired yet." />
    </RadarPageShell>
  );
}
