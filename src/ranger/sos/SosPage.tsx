import { useEffect, useRef, useState } from "preact/hooks";
import { LifeBuoy, MapPin, WifiOff } from "lucide-preact";
import { useDeviceLocation } from "@/store/location";
import { useSosStore } from "@/store/sos";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { SOS_REBEACON_MS } from "@/lib/timings";

/**
 * No-install SOS beacon — a bare link anyone (victim or bystander) can open
 * on any phone, no app, no login, no ranger identity. Broadcasts real GPS
 * position to radar over the same backend everything else uses. Deliberately
 * outside the personel/radar app shells (no BootSequence, no nav) — someone
 * in trouble shouldn't have to wait through a boot animation.
 */
export default function SosPage() {
  const { status: gpsStatus, coords } = useDeviceLocation();
  const { sendState, lastSentAt, send } = useSosStore();
  const online = useOnlineStatus();
  const [active, setActive] = useState(false);
  const [name, setName] = useState("");
  const beaconTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // The re-beacon interval outlives the render it was created in — read the
  // latest GPS fix and name through refs so a moving victim broadcasts where
  // they are now, not where they stood when they tapped the button.
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    return () => {
      if (beaconTimer.current) clearInterval(beaconTimer.current);
    };
  }, []);

  const activate = () => {
    setActive(true);
    if (coords) void send(coords.lat, coords.lon, name);
    if (beaconTimer.current) clearInterval(beaconTimer.current);
    beaconTimer.current = setInterval(() => {
      const latest = useSosStore.getState();
      const pos = coordsRef.current;
      if (pos) void latest.send(pos.lat, pos.lon, nameRef.current);
    }, SOS_REBEACON_MS);
  };

  const gpsReady = gpsStatus === "ready" || gpsStatus === "cached";

  return (
    <div className="min-h-dvh w-screen bg-black flex flex-col items-center justify-center gap-6 font-mono text-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {!online && (
        <div className="fixed top-0 inset-x-0 flex items-center justify-center gap-2 bg-[#93000a]/30 border-b border-[#FF0040]/50 text-[#ff8fa3] text-[11px] sm:text-xs uppercase tracking-wide px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 z-10">
          <WifiOff size={12} /> Tidak ada koneksi — lokasi akan terkirim otomatis saat sinyal kembali
        </div>
      )}

      <LifeBuoy size={48} className={active ? "text-[#66df75] animate-pulse" : "text-[#ff0040]"} />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#e5e2e1] uppercase tracking-wide">
          {active ? "Sinyal SOS Aktif" : "Kirim Sinyal SOS"}
        </h1>
        <p className="text-xs text-[#888] max-w-xs">
          Bagikan lokasi Anda ke tim penyelamat. Tidak perlu instal aplikasi.
        </p>
      </div>

      {!active && (
        <input
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="Nama Anda (opsional)"
          className="w-full max-w-xs bg-[#131313] border border-[#444] text-[#e5e2e1] text-sm px-3 py-2.5 text-center focus:border-[#66df75] outline-none"
        />
      )}

      {!active ? (
        <button
          type="button"
          disabled={!gpsReady}
          onClick={activate}
          className="w-full max-w-xs py-5 border-2 border-[#ff0040] bg-[#ff0040]/10 text-[#ff0040] text-lg font-bold uppercase tracking-wide disabled:opacity-40 active:scale-95 transition-transform"
        >
          {gpsReady ? "KIRIM LOKASI SAYA — SOS" : "Mencari GPS..."}
        </button>
      ) : (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <div className="flex items-center justify-center gap-2 text-[#66df75] text-sm">
            <MapPin size={14} />
            {sendState === "sent" && lastSentAt
              ? `Terkirim ${Math.max(0, Math.round((Date.now() - lastSentAt) / 1000))} detik lalu`
              : sendState === "queued"
                ? "Menunggu koneksi, akan otomatis dikirim..."
                : "Mengirim..."}
          </div>
          <p className="text-[10px] text-[#666]">
            Tetap buka halaman ini agar posisi terus diperbarui ke tim penyelamat.
          </p>
        </div>
      )}
    </div>
  );
}
