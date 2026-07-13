import { useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-preact";
import { PersonelPageShell } from "../components/PersonelPageShell";

type Urgency = "semua" | "tinggi" | "sedang" | "rendah";

interface Report {
  id: number;
  title: string;
  description: string;
  location: string;
  time: string;
  urgency: "tinggi" | "sedang" | "rendah";
  status: "BARU" | "DIPROSES" | "SELESAI";
}

const REPORTS: Report[] = [
  {
    id: 1,
    title: "Evakuasi Medis Darurat",
    description:
      "Laporan warga: Tiga orang terjebak dengan luka berat di reruntuhan lantai 2. Butuh tim ekstraksi segera.",
    location: "Sektor C, Blok 4 (Reruntuhan)",
    time: "14:05 WIB",
    urgency: "tinggi",
    status: "BARU",
  },
  {
    id: 2,
    title: "Distribusi Logistik Terhambat",
    description:
      "Jalur tertutup pohon tumbang. Kendaraan logistik tidak bisa melintas, membutuhkan alat berat.",
    location: "Jalur Utama Sektor A-B",
    time: "13:42 WIB",
    urgency: "sedang",
    status: "DIPROSES",
  },
  {
    id: 3,
    title: "Permintaan Informasi Jalur",
    description: "Warga meminta info jalur evakuasi alternatif.",
    location: "Posko Induk",
    time: "11:15 WIB",
    urgency: "rendah",
    status: "SELESAI",
  },
];

const urgencyColors: Record<string, string> = {
  tinggi: "text-[#ffb4ab] border-[#ffb4ab]",
  sedang: "text-[#fabd00] border-[#fabd00]",
  rendah: "text-[#66df75] border-[#66df75]",
};

const urgencyBg: Record<string, string> = {
  tinggi: "bg-[#330000]",
  sedang: "",
  rendah: "",
};

const statusColors: Record<string, string> = {
  BARU: "text-[#ffb2bd]",
  DIPROSES: "text-[#fabd00]",
  SELESAI: "text-[#66df75]",
};

export function DaftarLaporan() {
  const [activeTab, setActiveTab] = useState<"semua" | "aktif" | "selesai">("aktif");
  const [filterUrgency, setFilterUrgency] = useState<Urgency | null>(null);

  const filtered = REPORTS.filter((r) => {
    if (activeTab === "aktif" && r.status === "SELESAI") return false;
    if (activeTab === "selesai" && r.status !== "SELESAI") return false;
    if (filterUrgency && filterUrgency !== "semua" && r.urgency !== filterUrgency)
      return false;
    return true;
  });

  return (
    <PersonelPageShell title="Daftar Laporan" description="Insiden dan laporan taktis lapangan.">
      <div className="flex gap-4 mb-4 border-b border-[#444]">
        {(["semua", "aktif", "selesai"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 font-mono text-xs uppercase transition-colors border-b-2 ${
              activeTab === tab
                ? "text-[#ffb2bd] border-[#ffb2bd]"
                : "text-[#e1bec2] border-transparent hover:text-[#ffb2bd]"
            }`}
          >
            {tab === "semua" ? "Semua" : tab === "aktif" ? "Aktif" : "Selesai"}
          </button>
        ))}
      </div>

      <div className="mb-6 border-b border-[#444] pb-4">
        <span className="block font-mono text-xs text-[#e1bec2] mb-2">
          FILTER URGENSI:
        </span>
        <div className="flex flex-wrap gap-2">
          {(["tinggi", "sedang", "rendah"] as const).map((u) => (
            <button
              key={u}
              onClick={() =>
                setFilterUrgency(filterUrgency === u ? null : u)
              }
              className={`px-4 py-2 border font-mono text-xs uppercase transition-colors ${
                filterUrgency === u
                  ? urgencyColors[u]
                  : "text-[#e1bec2] border-[#444] hover:border-[#ffb2bd]"
              } ${filterUrgency === u ? "bg-[#330000]" : "bg-[#262626]"}`}
            >
              {u === "tinggi" ? "Tinggi" : u === "sedang" ? "Sedang" : "Rendah"}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <AnimatePresence mode="popLayout">
          {filtered.map((report) => (
            <motion.article
              key={report.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`bg-[#262626] border border-[#444] p-4 flex flex-col gap-3 hover:border-[#ffb2bd] transition-colors group relative ${
                report.status === "SELESAI" ? "opacity-70 hover:opacity-100" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`font-mono text-xs uppercase px-2 py-1 border ${urgencyColors[report.urgency]} ${urgencyBg[report.urgency]}`}
                >
                  {report.urgency === "tinggi"
                    ? "Urgensi Tinggi"
                    : report.urgency === "sedang"
                      ? "Urgensi Sedang"
                      : "Urgensi Rendah"}
                </span>
                <span className="font-mono text-xs text-[#e1bec2]">
                  {report.time}
                </span>
              </div>

              <h3 className="font-grotesk font-semibold text-lg text-[#e5e2e1] group-hover:text-[#ffb2bd] transition-colors">
                {report.title}
              </h3>
              <p className="font-mono text-sm text-[#e1bec2] mt-1">
                {report.description}
              </p>

              <div className="flex items-center gap-2 font-mono text-xs text-[#e1bec2] mt-2 bg-[#131313] p-2 border border-[#444]">
                <MapPin size={14} />
                <span>{report.location}</span>
              </div>

              <div className="mt-4 pt-4 border-t border-[#444] flex justify-between items-center">
                <div
                  className={`font-mono text-xs uppercase font-bold ${statusColors[report.status]}`}
                >
                  STATUS: {report.status}
                </div>
                <button className="bg-[#cb2957] text-[#ffe9eb] px-4 py-2 font-mono text-xs uppercase hover:bg-[#b8174a] transition-colors border border-transparent">
                  {report.status === "BARU"
                    ? "Tindak Lanjut"
                    : report.status === "DIPROSES"
                      ? "Update"
                      : "Arsip"}
                </button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>
    </PersonelPageShell>
  );
}
