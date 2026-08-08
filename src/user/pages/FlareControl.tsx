import { useState } from "preact/hooks";
import { motion } from "framer-motion";
import { Phone, PhoneCall, ShieldCheck, ChevronRight } from "lucide-preact";
import { UserPageShell } from "../components/UserPageShell";
import { FlareActivate } from "../components/FlareActivate";
import { StatusHeader } from "../components/StatusHeader";
import { EMERGENCY_CONTACTS } from "@/lib/config";

/** Emergency numbers from lib/config.ts, dressed with their lucide icons here. */
const CONTACTS = EMERGENCY_CONTACTS.map((c) => ({ ...c, icon: PhoneCall as typeof Phone }));

const STATUS_LOG = [
  { id: 1, text: "Sistem pemantauan aktif", time: "14:00", type: "info" },
  { id: 2, text: "Flare siap diaktifkan", time: "14:00", type: "info" },
  { id: 3, text: "GPS terkunci — posisi diketahui", time: "13:58", type: "success" },
  { id: 4, text: "Koneksi aman tersambung", time: "13:55", type: "success" },
];

export function FlareControl() {
  const [showContacts, setShowContacts] = useState(false);

  if (showContacts) {
    return (
      <div className="flex flex-col bg-[#131313]">
        <StatusHeader />
        <UserPageShell title="Kontak Darurat" description="Hubungi bantuan segera"
          action={<button onClick={() => setShowContacts(false)} className="font-mono text-[10px] text-[#ffb2bd] uppercase tracking-wider">Kembali</button>}>
          <div className="flex flex-col gap-2">
            {CONTACTS.map((contact, i) => {
              const Icon = contact.icon;
              return (
                <motion.button key={contact.name}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 28 }}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  className="w-full text-left bg-[#262626] border border-[#444] p-4 flex items-center gap-3 hover:border-[#ffb2bd] transition-colors group">
                  <div className="w-10 h-10 border border-[#444] flex items-center justify-center bg-[#2a2a2a] shrink-0 group-hover:border-[#ffb2bd] transition-colors"><Icon size={18} className="text-[#66df75]" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-grotesk font-semibold text-base text-[#e5e2e1] group-hover:text-[#ffb2bd] transition-colors">{contact.name}</h3>
                    <span className="font-mono text-xs text-[#66df75]">{contact.number}</span>
                  </div>
                  <ChevronRight size={14} className="text-[#666] group-hover:text-[#ffb2bd] shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </UserPageShell>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#131313]">
      <StatusHeader />
      <div className="p-4 flex flex-col gap-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-grotesk font-bold text-2xl text-[#e5e2e1] tracking-[-0.4px]">Mode Flare</h1>
          <p className="font-mono text-[10px] text-[#e1bec2] mt-0.5">Sistem Siaga Darurat — Sektor-07</p>
        </motion.div>
        <FlareActivate />
        <div>
          <h2 className="font-mono text-[10px] text-[#e1bec2] uppercase tracking-wider mb-3">Status Sistem</h2>
          <div className="flex flex-col gap-1">
            {STATUS_LOG.map((entry, i) => (
              <motion.div key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 28 }}
                className="flex items-start gap-3 p-2">
                <div className="flex flex-col items-center">
                  <div className={"w-2 h-2 rounded-full " + (entry.type === "success" ? "bg-[#66df75]" : "bg-[#ffb2bd]")} />
                  {i < STATUS_LOG.length - 1 && <div className="w-px h-full min-h-[20px] bg-[#444] mt-1" />}
                </div>
                <div className="flex-1 min-w-0"><span className="font-mono text-xs text-[#e5e2e1]">{entry.text}</span></div>
                <span className="font-mono text-[9px] text-[#666] shrink-0">{entry.time}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <motion.button onClick={() => setShowContacts(true)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }} whileTap={{ scale: 0.98 }}
          className="w-full bg-[#262626] border border-[#444] p-4 flex items-center justify-between hover:border-[#66df75] transition-colors group">
          <div className="flex items-center gap-3">
            <Phone size={18} className="text-[#66df75]" />
            <div className="text-left">
              <span className="font-grotesk font-semibold text-sm text-[#e5e2e1] group-hover:text-[#66df75] transition-colors">Kontak Darurat</span>
              <p className="font-mono text-[9px] text-[#e1bec2]">Hubungi bantuan segera</p>
            </div>
          </div>
          <ChevronRight size={14} className="text-[#666] group-hover:text-[#66df75]" />
        </motion.button>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="bg-[#93000a]/10 border border-[#FF0040]/30 p-3 flex items-start gap-2">
          <ShieldCheck size={14} className="text-[#ffb2bd] mt-0.5 shrink-0" />
          <p className="font-mono text-[10px] text-[#e1bec2] leading-relaxed">
            Mode Flare mengirim sinyal darurat ke pusat komando dengan posisi GPS Anda.
            Tim terdekat akan segera dihubungkan untuk memberikan bantuan.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
