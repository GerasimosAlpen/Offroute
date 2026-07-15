import { useQuery } from "@tanstack/preact-query";
import { personnelApi, type Personnel } from "@/lib/api";
import { RANGERS } from "@/lib/rangers";

/**
 * Fetches the live ranger roster from the backend.
 * Falls back to the static RANGERS constant if the API is unreachable.
 */
export function usePersonnel() {
  return useQuery<Personnel[], Error, (Personnel & { offset: [number, number] })[]>({
    queryKey: ["personnel"],
    queryFn: personnelApi.list,
    // Adapt API shape to match the local Ranger interface used in components
    select: (data) =>
      data.map((p) => ({
        ...p,
        offset: [p.offsetLat, p.offsetLon] as [number, number],
      })),
    placeholderData: RANGERS.map((r) => ({
      id: r.id,
      name: r.name,
      callsign: r.callsign,
      offsetLat: r.offset[0],
      offsetLon: r.offset[1],
      createdAt: "",
      updatedAt: "",
      // extra field to match local shape in select
    })),
    staleTime: 1000 * 60 * 5, // 5 min — roster doesn't change often
  });
}
