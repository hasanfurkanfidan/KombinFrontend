import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastState {
  message: string | null;
  /** A single button on the toast ("Geri al"); pressing it also hides the toast. */
  action: ToastAction | null;
  /** Monotonic id so showing the same message twice restarts the hide timer. */
  id: number;
  show: (message: string, action?: ToastAction) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  action: null,
  id: 0,
  show: (message, action) =>
    set((state) => ({ message, action: action ?? null, id: state.id + 1 })),
  hide: () => set({ message: null, action: null }),
}));

export function showToast(message: string, action?: ToastAction): void {
  useToastStore.getState().show(message, action);
}
