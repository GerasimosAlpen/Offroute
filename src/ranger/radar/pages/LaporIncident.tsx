import { RadarPageShell } from "../components/RadarPageShell";
import { Placeholder } from "../components/Placeholder";

export function LaporIncident() {
  return (
    <RadarPageShell
      title="Lapor Incident"
      description="Mark floods, tsunamis, earthquakes, and other incidents."
    >
      <Placeholder label="Incident report form — not wired yet." />
    </RadarPageShell>
  );
}
