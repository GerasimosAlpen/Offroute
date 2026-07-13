/**
 * Simulated Bluetooth-mesh personel roster — see TODO.md. Shared between the
 * tactical map (markers) and the task-assignment store so "Budi (TIM BRAVO)
 * took the crash" means the same ranger everywhere, not disconnected mocks.
 */
export interface Ranger {
  id: string;
  name: string;
  callsign: string;
  /** [lat, lon] offset from the radar operator's own position. */
  offset: [number, number];
}

export const RANGERS: Ranger[] = [
  { id: "bravo", name: "Budi", callsign: "TIM BRAVO", offset: [0.006, 0.004] },
  { id: "alpha", name: "Siti", callsign: "TIM ALPHA", offset: [-0.005, -0.003] },
  { id: "charlie", name: "Andi", callsign: "TIM CHARLIE", offset: [0.003, -0.007] },
  { id: "delta", name: "Dewi", callsign: "TIM DELTA", offset: [-0.007, 0.006] },
];
