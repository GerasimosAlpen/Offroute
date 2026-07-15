import { useEffect, useState } from "preact/hooks";
import { Wifi, WifiOff, Radio } from "lucide-preact";
import { socket } from "@/lib/socket";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { usePresenceStore } from "@/store/presence";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** Windows/macOS-style system tray: live clock + connectivity + unit count. */
export function SystemTray() {
  const [now, setNow] = useState(new Date());
  const [wsConnected, setWsConnected] = useState(socket.connected);
  const online = useOnlineStatus();
  const units = usePresenceStore((s) => Object.keys(s.units).length);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const onC = () => setWsConnected(true);
    const onD = () => setWsConnected(false);
    socket.on("connect", onC);
    socket.on("disconnect", onD);
    return () => {
      clearInterval(t);
      socket.off("connect", onC);
      socket.off("disconnect", onD);
    };
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const date = `${DAYS[now.getDay()]} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;

  return (
    <div className="shrink-0 flex items-center gap-3 pl-2 pr-1 font-mono">
      <span className="flex items-center gap-1 text-[10px]" title={`${units} unit daring`}>
        <Radio size={11} className="text-[#5fb3b3]" />
        <span className="text-[#888]">{units}</span>
      </span>
      <span title={online ? "Online" : "Offline"}>
        {online ? <Wifi size={12} className="text-[#66df75]" /> : <WifiOff size={12} className="text-[#ff0040]" />}
      </span>
      <span className="flex items-center gap-1" title={wsConnected ? "Realtime tersambung" : "Realtime terputus"}>
        <span className={`size-1.5 rounded-full ${wsConnected ? "bg-[#66df75]" : "bg-[#ff0040]"}`} />
      </span>
      <div className="flex flex-col items-end leading-none">
        <span className="text-[#e5e2e1] text-[11px] tabular-nums tracking-wide">{time}</span>
        <span className="text-[#666] text-[8px] uppercase tracking-wider">{date}</span>
      </div>
    </div>
  );
}
