import { create } from 'zustand';
import type { EditorState } from '../types';

// undo/redo 대상이 되는 직렬화 가능한 필드만 스냅샷한다.
// (zoom/미리보기/selectedId 등 순수 뷰 상태는 제외)
export const HISTORY_KEYS = [
  'name',
  'cell',
  'height',
  'capLeftWidth',
  'capRightWidth',
  'tileWidth',
  'strokeColor',
  'fillColor',
  'strokeWidth',
  'lineStyle',
  'cornerStyle',
  'cornerRadius',
  'dotLength',
  'dotGap',
  'waveAmp',
  'waveLen',
  'waveform',
  'tileMode',
  'minWidth',
  'contentInsets',
  'textColor',
  'fontSize',
  'bleed',
  'deco',
  'assets',
  'tail',
] as const;

export type Snapshot = Pick<EditorState, (typeof HISTORY_KEYS)[number]>;

export function pickSnapshot(s: EditorState): Snapshot {
  const out = {} as Record<string, unknown>;
  for (const k of HISTORY_KEYS) out[k] = s[k];
  // 깊은 복사 (assets/contentInsets/tail 보호)
  return JSON.parse(JSON.stringify(out)) as Snapshot;
}

const LIMIT = 100;
const COALESCE_MS = 700;

interface HistoryStore {
  past: Snapshot[];
  future: Snapshot[];
  lastLabel: string | null;
  lastTime: number;
  /** 변경 직전 상태를 기록. 같은 label 이 짧은 간격으로 연속되면 합친다. */
  record: (snap: Snapshot, label: string) => void;
  /** undo: present(현재 스냅샷)를 받아 직전 상태를 반환 */
  undo: (present: Snapshot) => Snapshot | null;
  redo: (present: Snapshot) => Snapshot | null;
  reset: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useHistory = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  lastLabel: null,
  lastTime: 0,

  record: (snap, label) => {
    const { lastLabel, lastTime, past } = get();
    const now = Date.now();
    if (label && label === lastLabel && now - lastTime < COALESCE_MS) {
      set({ lastTime: now });
      return; // 같은 동작의 연속 → 한 덩어리로 유지
    }
    set({
      past: [...past, snap].slice(-LIMIT),
      future: [],
      lastLabel: label,
      lastTime: now,
    });
  },

  undo: (present) => {
    const { past, future } = get();
    if (past.length === 0) return null;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [...future, present],
      lastLabel: null,
      lastTime: 0,
    });
    return prev;
  },

  redo: (present) => {
    const { past, future } = get();
    if (future.length === 0) return null;
    const next = future[future.length - 1];
    set({
      past: [...past, present],
      future: future.slice(0, -1),
      lastLabel: null,
      lastTime: 0,
    });
    return next;
  },

  reset: () => set({ past: [], future: [], lastLabel: null, lastTime: 0 }),
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
