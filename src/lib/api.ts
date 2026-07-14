import axios from "axios";

/**
 * Axios client pointed at the NestJS backend.
 * Base URL is configurable via VITE_API_URL env var (default: localhost:3000).
 */
export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000",
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

// ─── Typed API helpers ────────────────────────────────────────────────────────

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
  assign:         (dto: AssignTaskDto) => api.post("/tasks/assign", dto).then((r) => r.data),
  updateStatus:   (id: string, dto: UpdateTaskStatusDto) => api.patch(`/tasks/${id}/status`, dto).then((r) => r.data),
  updatePosition: (id: string, lat: number, lon: number) => api.post(`/tasks/${id}/position`, { lat, lon }).then((r) => r.data),
};

export const flareApi = {
  current:  () => api.get("/flare/current").then((r) => r.data),
  activate: () => api.post("/flare/activate").then((r) => r.data),
};

export const evacuationApi = {
  points:  () => api.get("/evacuation/points").then((r) => r.data),
  pending: () => api.get("/evacuation/pending").then((r) => r.data),
  request: (dto: CreateEvacRequestDto) => api.post("/evacuation/request", dto).then((r) => r.data),
  accept:  (id: string) => api.post(`/evacuation/accept/${id}`).then((r) => r.data),
  reject:  (id: string) => api.post(`/evacuation/reject/${id}`).then((r) => r.data),
};

export const messagesApi = {
  pins:   () => api.get("/messages/pins").then((r) => r.data),
  addPin: (dto: CreateMessagePinDto) => api.post("/messages/pin", dto).then((r) => r.data),
};

export const commsApi = {
  history: () => api.get("/comms/history").then((r) => r.data),
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
