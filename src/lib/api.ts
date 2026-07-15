import axios from "axios";
import { getApiBaseUrl } from "./apiBase";

/**
 * Axios client pointed at the NestJS backend.
 * Base URL resolution (runtime override → env → localhost) lives in apiBase.ts.
 */
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

// ─── Typed API helpers ────────────────────────────────────────────────────────

export interface HealthResult {
  ok: boolean;
  db: boolean;
  latencyMs: number;
}

export const healthApi = {
  /** Times a liveness+DB probe. Never throws — an unreachable API resolves to ok:false. */
  ping: async (): Promise<HealthResult> => {
    const started = performance.now();
    try {
      const r = await api.get<{ ok: boolean; db: boolean }>("/health", { timeout: 5000 });
      return { ok: Boolean(r.data?.ok), db: Boolean(r.data?.db), latencyMs: Math.round(performance.now() - started) };
    } catch {
      return { ok: false, db: false, latencyMs: Math.round(performance.now() - started) };
    }
  },
};

export interface DbStats {
  personnel: number;
  incidents: number;
  tasks: number;
  resolved: number;
  victims: number;
  evacPoints: number;
  evacRequests: number;
  comms: number;
  messagePins: number;
  flares: number;
}

export const adminApi = {
  stats:  () => api.get<DbStats>("/admin/stats").then((r) => r.data),
  reseed: () => api.post<{ ok: boolean } & DbStats>("/admin/reseed").then((r) => r.data),
};

export const personnelApi = {
  list: () => api.get<Personnel[]>("/personnel").then((r) => r.data),
  one:  (id: string) => api.get<Personnel>(`/personnel/${id}`).then((r) => r.data),
};

export const incidentsApi = {
  list:   () => api.get<Incident[]>("/incidents").then((r) => r.data),
  create: (dto: CreateIncidentDto) => api.post<Incident>("/incidents", dto).then((r) => r.data),
};

export const tasksApi = {
  list:           () => api.get("/tasks").then((r) => r.data),
  resolved:       () => api.get("/tasks/resolved").then((r) => r.data),
  assign:         (dto: AssignTaskDto) => api.post("/tasks/assign", dto).then((r) => r.data),
  selfAssign:     (dto: SelfAssignTaskDto) => api.post("/tasks/self-assign", dto).then((r) => r.data),
  updateStatus:   (id: string, dto: UpdateTaskStatusDto) => api.patch(`/tasks/${id}/status`, dto).then((r) => r.data),
  confirm:        (id: string) => api.post(`/tasks/${id}/confirm`).then((r) => r.data),
  reject:         (id: string) => api.post(`/tasks/${id}/reject`).then((r) => r.data),
  updatePosition: (id: string, lat: number, lon: number) => api.post(`/tasks/${id}/position`, { lat, lon }).then((r) => r.data),
};

export const flareApi = {
  current:    () => api.get("/flare/current").then((r) => r.data),
  activate:   () => api.post("/flare/activate").then((r) => r.data),
  deactivate: () => api.post("/flare/deactivate").then((r) => r.data),
};

export const evacuationApi = {
  points:      () => api.get("/evacuation/points").then((r) => r.data),
  pending:     () => api.get("/evacuation/pending").then((r) => r.data),
  request:     (dto: CreateEvacRequestDto) => api.post("/evacuation/request", dto).then((r) => r.data),
  accept:      (id: string) => api.post(`/evacuation/accept/${id}`).then((r) => r.data),
  reject:      (id: string) => api.post(`/evacuation/reject/${id}`).then((r) => r.data),
  removePoint: (id: string) => api.delete(`/evacuation/points/${id}`).then((r) => r.data),
};

export const messagesApi = {
  pins:   () => api.get("/messages/pins").then((r) => r.data),
  addPin: (dto: CreateMessagePinDto) => api.post("/messages/pin", dto).then((r) => r.data),
};

export const commsApi = {
  history: () => api.get("/comms/history").then((r) => r.data),
  append:  (dto: CreateCommsEntryDto) => api.post("/comms", dto).then((r) => r.data),
};

export const victimsApi = {
  active:       () => api.get<Victim[]>("/victims/active").then((r) => r.data),
  sos:          (dto: SosPingDto) => api.post<Victim>("/victims/sos", dto).then((r) => r.data),
  assign:       (id: string, dto: RangerRefDto) => api.post<Victim>(`/victims/${id}/assign`, dto).then((r) => r.data),
  report:       (id: string, dto: RangerRefDto) => api.post<Victim>(`/victims/${id}/report`, dto).then((r) => r.data),
  rejectReport: (id: string) => api.post<Victim>(`/victims/${id}/reject-report`).then((r) => r.data),
  confirm:      (id: string) => api.post(`/victims/${id}/confirm`).then((r) => r.data),
};

// ─── DTO / Response types (mirrors backend contracts) ─────────────────────────

export interface Personnel {
  id: string;
  name: string;
  callsign: string;
  offsetLat: number;
  offsetLon: number;
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  kind: "fire" | "blocked" | "medical" | "crash" | "theft";
  label: string;
  description: string;
  severity: "critical" | "warning" | "info";
  offsetLat: number;
  offsetLon: number;
  reportedAt: string;
}

export interface CreateIncidentDto {
  kind: Incident["kind"];
  label: string;
  description: string;
  severity: Incident["severity"];
  offsetLat: number;
  offsetLon: number;
}

export interface AssignTaskDto {
  hazardId: string;
  baseLat: number;
  baseLon: number;
}

export interface SelfAssignTaskDto {
  hazardId: string;
  rangerId: string;
  unitLat: number;
  unitLon: number;
}

export interface UpdateTaskStatusDto {
  status: "enroute" | "arrived";
  unitLat?: number;
  unitLon?: number;
}

export interface CreateEvacRequestDto {
  rangerId: string;
  rangerName: string;
  callsign: string;
  atLat: number;
  atLon: number;
  incidentLat: number;
  incidentLon: number;
}

export interface CreateMessagePinDto {
  rangerId: string;
  rangerName: string;
  callsign: string;
  text: string;
  lat: number;
  lon: number;
}

export interface CreateCommsEntryDto {
  sender: string;
  color: string;
  lead: string;
  body: string;
}

export interface Victim {
  id: string;
  label: string | null;
  lat: number;
  lon: number;
  status: "active" | "rescued";
  assignedRangerId: string | null;
  assignedRangerName: string | null;
  assignedCallsign: string | null;
  reportedRangerId: string | null;
  reportedRangerName: string | null;
  reportedCallsign: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface SosPingDto {
  id: string;
  label?: string;
  lat: number;
  lon: number;
}

export interface RangerRefDto {
  rangerId: string;
  rangerName: string;
  callsign: string;
}
