import { useEffect, useRef, useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Radio, Siren, UserCheck, Shield } from "lucide-preact";

interface Channel {
  id: string;
  label: string;
  icon: typeof Radio;
  desc: string;
}

const CHANNELS: Channel[] = [
  { id: "command", label: "COMMAND", icon: Radio, desc: "HQ COMMAND" },
  { id: "taktis", label: "TAKTIS", icon: Siren, desc: "TAKTIS CHANNEL" },
  { id: "medis", label: "MEDIS", icon: UserCheck, desc: "MEDICAL CORPS" },
  { id: "logistik", label: "LOGISTIK", icon: Shield, desc: "LOGISTICS UNIT" },
];

interface Message {
  id: number;
  sender: string;
  time: string;
  text: string;
  type: "incoming" | "outgoing" | "critical" | "data";
  data?: { target?: string };
}

const CHANNEL_MESSAGES: Record<string, Message[]> = {
  command: [
    { id: 1, sender: "HQ COMMAND", time: "09:42", text: "Ranger Alpha, update visual pada Sektor 4. Pergerakan anomali terdeteksi di grid Delta-7. Laporkan status.", type: "incoming" },
    { id: 2, sender: "YOU", time: "09:44", text: "Menuju ke lokasi. Jarak pandang terbatas karena kabut asap. Peralatan sensor aktif.", type: "outgoing" },
    { id: 3, sender: "HQ COMMAND", time: "09:50", text: "WARNING: Struktur di D-7 tidak stabil. Siagakan Mode Flare jika diperlukan evakuasi darurat.", type: "critical" },
  ],
  taktis: [
    { id: 1, sender: "R-BRAVO", time: "10:12", text: "Sektor C aman. Tidak ada pergerakan mencurigakan.", type: "incoming" },
    { id: 2, sender: "R-DELTA", time: "10:14", text: "Sektor D butuh tambahan personel di pos 3.", type: "incoming" },
    { id: 3, sender: "HQ COMMAND (DATA LINK)", time: "10:16", text: "COORD DATA RECEIVED. PROCEED WITH CAUTION.", type: "data", data: { target: "D-7" } },
  ],
  medis: [
    { id: 1, sender: "MEDICAL CORPS", time: "08:30", text: "Stok obat di posko tinggal 40%. Request resupply.", type: "incoming" },
    { id: 2, sender: "YOU", time: "08:32", text: "Resupply akan dikirim dalam 30 menit via R-ECHO.", type: "outgoing" },
  ],
  logistik: [
    { id: 1, sender: "LOGISTICS UNIT", time: "07:15", text: "Konvoi logistik dari Posko Pusat telah berangkat.", type: "incoming" },
    { id: 2, sender: "YOU", time: "07:16", text: "Copy. Kami siap terima di titik distribusi.", type: "outgoing" },
    { id: 3, sender: "LOGISTICS UNIT", time: "07:20", text: "ETA 45 menit. Pastikan akses jalan bersih.", type: "incoming" },
  ],
};

export function Komunikasi() {
  const [channel, setChannel] = useState("command");
  const [messages, setMessages] = useState<Message[]>(CHANNEL_MESSAGES.command);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(CHANNEL_MESSAGES[channel] || []);
  }, [channel]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: messages.length + 1,
      sender: "YOU",
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      text: input.trim(),
      type: "outgoing",
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    CHANNEL_MESSAGES[channel] = [...(CHANNEL_MESSAGES[channel] || []), newMsg];
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeChannel = CHANNELS.find((c) => c.id === channel);

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#131313] flex flex-col">
      <header className="bg-[#262626] border-b-2 border-[#444] shrink-0">
        <div className="px-4 pt-3 pb-2 flex justify-between items-center">
          <div>
            <h1 className="font-grotesk font-bold text-xl text-[#e5e2e1]">
              Komunikasi Taktis
            </h1>
            <p className="font-mono text-xs text-[#66df75] mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#66df75] animate-pulse" />
              {activeChannel?.desc || "SEC-CH-ALPHA"} — Enkripsi aktif.
            </p>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 border border-[#66df75] bg-[#66df75]/10">
            <span className="font-mono text-[9px] text-[#66df75] tracking-wider">ENKRIPSI AKTIF</span>
          </div>
        </div>
        <div className="flex gap-0 px-4 overflow-x-auto">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const active = channel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase transition-colors border-b-2 ${
                  active
                    ? "text-[#ffb2bd] border-[#ffb2bd]"
                    : "text-[#e1bec2] border-transparent hover:text-[#ffb2bd] hover:border-[#ffb2bd]/50"
                }`}
              >
                <Icon size={12} />
                {ch.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 flex flex-col gap-6">
        <AnimatePresence initial={false} mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className={`flex flex-col max-w-[85%] ${
                msg.type === "outgoing" ? "items-end self-end" : "items-start"
              }`}
            >
              <span
                className={`font-mono text-[10px] mb-1 ${
                  msg.type === "outgoing"
                    ? "text-[#ffb2bd]"
                    : msg.type === "critical"
                      ? "text-[#FF0040] animate-pulse"
                      : "text-[#e1bec2]"
                }`}
              >
                {msg.sender} • {msg.time}
              </span>

              {msg.type === "data" && msg.data ? (
                <div className="bg-[#1a2e20] border border-[#66df75] w-full min-w-[200px]">
                  <div className="px-3 py-3">
                    <span className="inline-block bg-[#131313]/80 text-[#66df75] font-mono text-[10px] px-1.5 border border-[#66df75] mb-2">
                      TARGET: {msg.data.target || "—"}
                    </span>
                    <p className="font-mono text-xs text-[#66df75]">{msg.text}</p>
                    <button className="mt-2 w-full border border-[#66df75] text-[#66df75] font-mono py-2 hover:bg-[#66df75] hover:text-[#00390f] transition-colors uppercase text-xs">
                      Set sbg Titik Evakuasi
                    </button>
                  </div>
                </div>
              ) : msg.type === "critical" ? (
                <div className="bg-[#93000a]/20 border-l-4 border-[#FF0040] p-4">
                  <p className="font-mono text-sm font-bold text-[#FF0040]">{msg.text}</p>
                </div>
              ) : (
                <div
                  className={`px-4 py-3 ${
                    msg.type === "outgoing"
                      ? "bg-[#353535] border border-[#a8898c]"
                      : "bg-[#262626] border border-[#444]"
                  }`}
                >
                  <p className="font-mono text-sm text-[#e5e2e1]">{msg.text}</p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      <div className="bg-[#131313] border-t border-[#444] px-3 py-2 shrink-0">
        <div className="flex items-end gap-2">
          <button className="size-10 flex items-center justify-center border border-[#444] bg-[#131313] hover:bg-[#353535] text-[#ffb2bd] transition-colors shrink-0 active:scale-95">
            <Plus size={18} />
          </button>
          <div className="flex-1 relative">
            <input
              value={input}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-black border border-[#444] text-[#e5e2e1] font-mono text-sm focus:ring-0 focus:border-[#ffb2bd] px-3 py-2.5 placeholder:text-[#e1bec2]/50 transition-colors"
              placeholder="Ketik laporan taktis..."
              type="text"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
