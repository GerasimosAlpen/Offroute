import { useState } from "preact/hooks";
import { MapPin, Check } from "lucide-preact";
import { RadarPageShell } from "../components/RadarPageShell";
import { useDeviceLocation, setManualLocation } from "@/store/location";

const STATUS_LABEL: Record<string, string> = {
  cached: "Posisi tersimpan (belum GPS terbaru)",
  locating: "Mencari sinyal GPS...",
  resolving: "GPS ditemukan, menerjemahkan lokasi...",
  ready: "Aktif",
  denied: "Akses GPS ditolak",
  unavailable: "GPS tidak tersedia",
};

export function RadarSettings() {
  const { status, label, coords } = useDeviceLocation();
  const [lat, setLat] = useState(coords ? String(coords.lat) : "");
  const [lon, setLon] = useState(coords ? String(coords.lon) : "");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  const gpsBroken = status === "denied" || status === "unavailable";

  const submit = () => {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return;
    setManualLocation(latNum, lonNum, name);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <RadarPageShell
      title="Settings"
      description="Console preferences and device configuration."
    >
      <div className="max-w-md bg-[#1e1e1e] border border-[#333] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-[#e1bec2]" />
          <span className="font-mono text-sm text-white uppercase tracking-wide">Posisi Markas</span>
        </div>

        <p className="font-mono text-xs text-[#888]">
          Status GPS: <span className={gpsBroken ? "text-[#ff8fa3]" : "text-[#66df75]"}>{STATUS_LABEL[status] ?? status}</span>
          {" — "}{label}
        </p>

        {gpsBroken && (
          <p className="font-mono text-[11px] text-[#fabd00] leading-relaxed">
            GPS tidak dapat diakses dari aplikasi desktop ini (keterbatasan webview, bukan masalah izin).
            Radar adalah pos komando tetap — atur posisi secara manual sekali di bawah ini.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[10px] text-[#888] uppercase tracking-wide">
            Nama lokasi (opsional)
            <input
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="Jakarta Pusat"
              className="mt-1 w-full bg-black border border-[#444] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#e1bec2] outline-none"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex-1 font-mono text-[10px] text-[#888] uppercase tracking-wide">
              Latitude
              <input
                value={lat}
                onInput={(e) => setLat((e.target as HTMLInputElement).value)}
                placeholder="-6.2088"
                className="mt-1 w-full bg-black border border-[#444] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#e1bec2] outline-none"
              />
            </label>
            <label className="flex-1 font-mono text-[10px] text-[#888] uppercase tracking-wide">
              Longitude
              <input
                value={lon}
                onInput={(e) => setLon((e.target as HTMLInputElement).value)}
                placeholder="106.8456"
                className="mt-1 w-full bg-black border border-[#444] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#e1bec2] outline-none"
              />
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          className="flex items-center justify-center gap-2 border border-[#66df75] bg-[#66df75]/10 text-[#66df75] font-mono text-xs uppercase tracking-wide py-2.5 hover:bg-[#66df75]/20 transition-colors"
        >
          {saved ? <><Check size={13} /> Tersimpan</> : "Simpan Posisi Markas"}
        </button>
      </div>
    </RadarPageShell>
  );
}
