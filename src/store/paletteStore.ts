import { create } from 'zustand';

// 픽셀아트 친화 기본 프리셋 (제한 팔레트)
const PRESETS = [
  '#e7405a', '#ffd7df', '#f59e0b', '#fde68a', '#34d399', '#a7f3d0',
  '#6ea8fe', '#bfdbfe', '#a78bfa', '#1b1b1f', '#ffffff', '#9ca3af',
];

const LS_KEY = 'pbe.palette.recent';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* noop */
  }
  return [];
}

interface PaletteStore {
  presets: string[];
  recent: string[];
  addRecent: (hex: string) => void;
}

export const usePalette = create<PaletteStore>((set, get) => ({
  presets: PRESETS,
  recent: loadRecent(),
  addRecent: (hex) => {
    const h = hex.toLowerCase();
    const next = [h, ...get().recent.filter((c) => c !== h)].slice(0, 12);
    set({ recent: next });
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  },
}));
