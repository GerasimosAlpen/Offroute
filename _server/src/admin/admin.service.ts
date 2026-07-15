import { Injectable } from "@nestjs/common";
import { PrismaService, type PrismaTx } from "../prisma/prisma.service";
import { EventsGateway } from "../gateway/events.gateway";

// Canonical seed — mirrors prisma/seed.ts, src/lib/rangers.ts, src/lib/hazards.ts.
const RANGERS = [
  { id: "bravo", name: "Budi", callsign: "TIM BRAVO", offsetLat: 0.006, offsetLon: 0.004 },
  { id: "alpha", name: "Siti", callsign: "TIM ALPHA", offsetLat: -0.005, offsetLon: -0.003 },
  { id: "charlie", name: "Andi", callsign: "TIM CHARLIE", offsetLat: 0.003, offsetLon: -0.007 },
  { id: "delta", name: "Dewi", callsign: "TIM DELTA", offsetLat: -0.007, offsetLon: 0.006 },
];

const INCIDENTS = [
  { id: "a01", kind: "fire" as const, label: "A01 - API", description: "Sektor Utara. Butuh bantuan pemadaman segera.", severity: "critical" as const, offsetLat: 0.004, offsetLon: -0.002 },
  { id: "road1", kind: "blocked" as const, label: "JALUR PUTUS", description: "Jalan Sudirman terblokir puing. Rute dialihkan.", severity: "warning" as const, offsetLat: -0.003, offsetLon: 0.005 },
  { id: "med1", kind: "medical" as const, label: "EVAK MEDIS", description: "Zona Selatan siap menerima warga sipil.", severity: "info" as const, offsetLat: -0.001, offsetLon: -0.006 },
  { id: "crash1", kind: "crash" as const, label: "KECELAKAAN", description: "Tabrakan dua kendaraan, satu jalur tertutup.", severity: "warning" as const, offsetLat: 0.0025, offsetLon: 0.0075 },
  { id: "theft1", kind: "theft" as const, label: "LAPORAN PENCURIAN", description: "Laporan warga, pelaku dilaporkan kabur ke arah timur.", severity: "warning" as const, offsetLat: -0.006, offsetLon: 0.0015 },
];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  /** Live row counts across every domain table — the monitor's DB pane. */
  async stats() {
    const [personnel, incidents, tasks, resolved, victims, evacPoints, evacRequests, comms, messagePins, flares] = await Promise.all([
      this.prisma.personnel.count(),
      this.prisma.incident.count(),
      this.prisma.task.count(),
      this.prisma.resolvedHazard.count(),
      this.prisma.victim.count(),
      this.prisma.evacuationPoint.count(),
      this.prisma.evacuationRequest.count(),
      this.prisma.commsEntry.count(),
      this.prisma.messagePin.count(),
      this.prisma.flareAlert.count(),
    ]);
    return { personnel, incidents, tasks, resolved, victims, evacPoints, evacRequests, comms, messagePins, flares };
  }

  /**
   * Wipe all transient/operational data and everything reported during a
   * session (accumulated test incidents, victims, tasks, comms, evac, flare,
   * pins), then restore the canonical rangers + seed incidents. Destructive
   * by design — this is the "reset mock data" the operator triggers. Runs in
   * one transaction, in FK-safe order.
   */
  async reseed() {
    await this.prisma.$transaction(async (tx: PrismaTx) => {
      // Children / dependents first.
      await tx.flareDispatch.deleteMany({});
      await tx.flareAlert.deleteMany({});
      await tx.task.deleteMany({});
      await tx.resolvedHazard.deleteMany({});
      await tx.evacuationPoint.deleteMany({});
      await tx.evacuationRequest.deleteMany({});
      await tx.messagePin.deleteMany({});
      await tx.commsEntry.deleteMany({});
      await tx.victim.deleteMany({});
      // Now the roots: incidents (all — including session-reported ones) and personnel.
      await tx.incident.deleteMany({});
      await tx.personnel.deleteMany({});

      // Restore canonical seed.
      for (const r of RANGERS) await tx.personnel.create({ data: r });
      for (const inc of INCIDENTS) await tx.incident.create({ data: inc });
      await tx.commsEntry.createMany({
        data: [
          { sender: "PUSAT", color: "#66df75", lead: "PEMBARUAN", body: "data satelit selesai.", time: "08:45:12" },
          { sender: "TIM BRAVO", color: "#e5e2e1", lead: "POSISI DI", body: "Koor 06°13'S. Menunggu instruksi.", time: "08:44:05" },
          { sender: "SISTEM", color: "#ff0040", lead: "DETEKSI", body: "anomali suhu di Sektor Utara.", time: "08:40:22" },
          { sender: "TIM ALPHA", color: "#e5e2e1", lead: "SELESAI", body: "menyisir area perumahan. Negatif korban.", time: "08:35:10" },
        ],
      });
    });

    // Nudge every connected client to re-hydrate from the fresh state.
    this.gateway.emit("data-reset", { ts: Date.now() });
    return { ok: true, ...(await this.stats()) };
  }
}
