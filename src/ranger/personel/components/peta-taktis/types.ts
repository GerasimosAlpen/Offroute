export interface EventMarker {
  id: string;
  name: string;
  type: "KEBAKARAN" | "BENCANA" | "MEDIS" | "KEAMANAN";
  danger: "KRITIS" | "TINGGI" | "SEDANG";
  label: string;
  pos: [number, number];
  distance: string;
  /** Live incidents don't carry a casualty count yet — undefined renders as "—", never a made-up number. */
  affected?: number;
}

export const DANGER_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  KRITIS: { border: "#FF0040", bg: "rgba(255,0,64,0.18)", text: "#FF0040", glow: "0 0 12px rgba(255,0,64,0.5)" },
  TINGGI: { border: "#ffb2bd", bg: "rgba(255,178,189,0.12)", text: "#ffb2bd", glow: "0 0 8px rgba(255,178,189,0.3)" },
  SEDANG: { border: "#fabd00", bg: "rgba(250,189,0,0.12)", text: "#fabd00", glow: "" },
};
