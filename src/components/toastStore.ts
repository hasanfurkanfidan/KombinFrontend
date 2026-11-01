import { create } from 'zustand';

interface ToastState {
  message: string | null;
  /** Monotonic id so showing the same message twice restarts the hide timer. */
  id: number;
  show: (message: string) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  id: 0,
  show: (message) => set((state) => ({ message, id: state.id + 1 })),
  hide: () => set({ message: null }),
}));

export function showToast(message: string): void {
  useToastStore.getState().show(message);
}
