import { create } from 'zustand';

/** A photo as the picker hands it over; the size is only needed to decide whether to shrink it. */
export interface PickedPhoto {
  uri: string;
  width?: number;
  height?: number;
}

export type AddSource = 'camera' | 'library';

interface AddState {
  /** "3/10 yükleniyor": set while several photos are being sent one after another. */
  uploading: { current: number; total: number } | null;
  /** The photo on the phone behind a card, shown until the server has its own thumbnail. Memory only. */
  localUris: Record<string, string>;
  /** Cards whose upload failed before the server could analyse them: a tap sends the photo again. */
  retryPhotos: Record<string, { photo: PickedPhoto; source: AddSource }>;
  /** Why a card ended `Failed` (the backend's `failureReason`, or the upload error). Memory only. */
  failureReasons: Record<string, string>;
  /** The wardrobe tab is focused: only then does a ready item open the confirm sheet by itself. */
  onWardrobeScreen: boolean;
  /** Ready items waiting for the user's one-tap confirmation, oldest first. */
  confirmQueue: string[];
  setUploading: (progress: AddState['uploading']) => void;
  setLocalUri: (id: string, uri: string) => void;
  renameLocal: (from: string, to: string) => void;
  setRetry: (id: string, entry: AddState['retryPhotos'][string]) => void;
  clearRetry: (id: string) => void;
  setFailureReason: (id: string, reason: string | null) => void;
  setOnWardrobeScreen: (focused: boolean) => void;
  enqueueConfirm: (id: string) => void;
  dequeueConfirm: (id: string) => void;
  reset: () => void;
}

const initial = {
  uploading: null,
  localUris: {},
  retryPhotos: {},
  failureReasons: {},
  onWardrobeScreen: false,
  confirmQueue: [],
};

export const useAddStore = create<AddState>((set) => ({
  ...initial,
  setUploading: (uploading) => set({ uploading }),
  setLocalUri: (id, uri) => set((state) => ({ localUris: { ...state.localUris, [id]: uri } })),
  renameLocal: (from, to) =>
    set((state) => {
      const uri = state.localUris[from];
      if (uri === undefined) {
        return state;
      }
      const { [from]: _moved, ...rest } = state.localUris;
      return { localUris: { ...rest, [to]: uri } };
    }),
  setRetry: (id, entry) => set((state) => ({ retryPhotos: { ...state.retryPhotos, [id]: entry } })),
  clearRetry: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.retryPhotos;
      return { retryPhotos: rest };
    }),
  setFailureReason: (id, reason) =>
    set((state) => {
      if (reason === null) {
        const { [id]: _removed, ...rest } = state.failureReasons;
        return { failureReasons: rest };
      }
      return { failureReasons: { ...state.failureReasons, [id]: reason } };
    }),
  setOnWardrobeScreen: (onWardrobeScreen) => set({ onWardrobeScreen }),
  enqueueConfirm: (id) =>
    set((state) =>
      state.confirmQueue.includes(id) ? state : { confirmQueue: [...state.confirmQueue, id] },
    ),
  dequeueConfirm: (id) =>
    set((state) => ({ confirmQueue: state.confirmQueue.filter((queued) => queued !== id) })),
  reset: () => set(initial),
}));
