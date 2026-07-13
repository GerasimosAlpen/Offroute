import "@/lib/leaflet-setup";
import { RadarPageShell } from "../components/RadarPageShell";
import { Placeholder } from "../components/Placeholder";

export function TacticalMap() {
  return (
    <RadarPageShell
      title="Tactical Map"
      description="Live node positions, incidents, and dispatch overlay."
    ></RadarPageShell>
  );
}
