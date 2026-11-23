import { create } from 'zustand';

interface BulkState {
  /**
   * A batch of this session was added: the advice screen is not shown first any more (it stays one tap away).
   * Memory only, like every bulk-add value: nothing of a bulk add is written to the phone.
   */
  adviceSeen: boolean;
  markAdviceSeen: () => void;
  reset: () => void;
}

export const useBulkStore = create<BulkState>((set) => ({
  adviceSeen: false,
  markAdviceSeen: () => set({ adviceSeen: true }),
  reset: () => set({ adviceSeen: false }),
}));
