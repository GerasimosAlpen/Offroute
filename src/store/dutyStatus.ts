import { create } from "zustand";
import { useCommsLogStore } from "./commsLog";

export type DutyStatus = "on_duty" | "idle";

const STORAGE_KEY = "offroute.personel.dutyStatus";

function loadStored(): DutyStatus {
  return localStorage.getItem(STORAGE_KEY) === "idle" ? "idle" : "on_duty";
}

interface DutyStatusState {
  status: DutyStatus;
  /** Sets status and announces the change over the shared comms log — radar sees it as a normal message, not a silent state flip. */
  setStatus: (status: DutyStatus, selfLabel: string) => void;
}

export const useDutyStatusStore = create<DutyStatusState>((set) => ({
  status: loadStored(),

  setStatus: (status, selfLabel) => {
    set({ status });
    localStorage.setItem(STORAGE_KEY, status);
    useCommsLogStore.getState().append({
      sender: selfLabel,
      color: status === "idle" ? "#66df75" : "#fabd00",
      lead: "STATUS UNIT",
      body:
        status === "idle"
          ? "tugas selesai, kembali ke status IDLE — siap menerima tugas baru."
          : "kembali BERTUGAS.",
    });
  },
}));
