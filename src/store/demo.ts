import { create } from "zustand";

interface DemoState {
  count: number;
  messages: string[];
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  push: (msg: string) => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  count: 0,
  messages: [],
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
  reset: () => set({ count: 0, messages: [] }),
  push: (msg) => set((s) => ({ messages: [msg, ...s.messages].slice(0, 4) })),
}));
