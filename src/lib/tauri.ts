// true only when running inside the Tauri binary
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
