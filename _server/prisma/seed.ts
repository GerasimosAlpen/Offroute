import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma";

// Prisma v7 requires a driver adapter — use pg pool with DIRECT_URL
const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Offroute database...");

  // ─── Personnel (Rangers) — mirrors RANGERS in src/lib/rangers.ts ────────────
  const rangers = [
    { id: "bravo",   name: "Budi",  callsign: "TIM BRAVO",   offsetLat: 0.006,  offsetLon: 0.004  },
    { id: "alpha",   name: "Siti",  callsign: "TIM ALPHA",   offsetLat: -0.005, offsetLon: -0.003 },
    { id: "charlie", name: "Andi",  callsign: "TIM CHARLIE", offsetLat: 0.003,  offsetLon: -0.007 },
    { id: "delta",   name: "Dewi",  callsign: "TIM DELTA",   offsetLat: -0.007, offsetLon: 0.006  },
  ];

  for (const r of rangers) {
    await prisma.personnel.upsert({
      where: { id: r.id },
      update: { name: r.name, callsign: r.callsign, offsetLat: r.offsetLat, offsetLon: r.offsetLon },
      create: r,
    });
  }
  console.log(`✅ Seeded ${rangers.length} personnel`);

  // ─── Incidents (Hazards) — mirrors HAZARDS in src/lib/hazards.ts ────────────
  const incidents = [
    { id: "a01",    kind: "fire"    as const, label: "A01 - API",         description: "Sektor Utara. Butuh bantuan pemadaman segera.",         severity: "critical" as const, offsetLat: 0.004,  offsetLon: -0.002  },
    { id: "road1",  kind: "blocked" as const, label: "JALUR PUTUS",       description: "Jalan Sudirman terblokir puing. Rute dialihkan.",       severity: "warning"  as const, offsetLat: -0.003, offsetLon: 0.005   },
    { id: "med1",   kind: "medical" as const, label: "EVAK MEDIS",        description: "Zona Selatan siap menerima warga sipil.",               severity: "info"     as const, offsetLat: -0.001, offsetLon: -0.006  },
    { id: "crash1", kind: "crash"   as const, label: "KECELAKAAN",        description: "Tabrakan dua kendaraan, satu jalur tertutup.",          severity: "warning"  as const, offsetLat: 0.0025, offsetLon: 0.0075  },
    { id: "theft1", kind: "theft"   as const, label: "LAPORAN PENCURIAN", description: "Laporan warga, pelaku dilaporkan kabur ke arah timur.", severity: "warning"  as const, offsetLat: -0.006, offsetLon: 0.0015  },
  ];

  for (const inc of incidents) {
    await prisma.incident.upsert({
      where: { id: inc.id },
      update: { label: inc.label, description: inc.description, severity: inc.severity },
      create: inc,
    });
  }
  console.log(`✅ Seeded ${incidents.length} incidents`);

  // ─── Initial CommsLog — mirrors INITIAL_LOG in src/store/commsLog.ts ────────
  const existingComms = await prisma.commsEntry.count();
  if (existingComms === 0) {
    await prisma.commsEntry.createMany({
      data: [
        { sender: "PUSAT",     color: "#66df75", lead: "PEMBARUAN", body: "data satelit selesai.",                    time: "08:45:12" },
        { sender: "TIM BRAVO", color: "#e5e2e1", lead: "POSISI DI", body: "Koor 06°13'S. Menunggu instruksi.",        time: "08:44:05" },
        { sender: "SISTEM",    color: "#ff0040", lead: "DETEKSI",   body: "anomali suhu di Sektor Utara.",            time: "08:40:22" },
        { sender: "TIM ALPHA", color: "#e5e2e1", lead: "SELESAI",   body: "menyisir area perumahan. Negatif korban.", time: "08:35:10" },
      ],
    });
    console.log("✅ Seeded initial comms log");
  } else {
    console.log("⏭️  Comms log already seeded — skipping");
  }

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
