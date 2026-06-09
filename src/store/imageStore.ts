import { create } from 'zustand';

interface ImageStore {
  images: Map<string, HTMLImageElement>;
  version: number; // 변경 트리거
  setImage: (id: string, img: HTMLImageElement) => void;
  removeImage: (id: string) => void;
}

export const useImages = create<ImageStore>((set, get) => ({
  images: new Map(),
  version: 0,
  setImage: (id, img) => {
    get().images.set(id, img);
    set({ version: get().version + 1 });
  },
  removeImage: (id) => {
    get().images.delete(id);
    set({ version: get().version + 1 });
  },
}));
