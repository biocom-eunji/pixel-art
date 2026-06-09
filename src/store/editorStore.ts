import { create } from 'zustand';
import type {
  Asset,
  ContentInsets,
  CornerStyle,
  EditorState,
  LineStyle,
  TailConfig,
  TileMode,
} from '../types';
import { HISTORY_KEYS, pickSnapshot, useHistory, type Snapshot } from './historyStore';
import { useImages } from './imageStore';
import { loadImage, svgToUrl } from '../lib/svg';

let idCounter = 1;
const nextId = () => `a${idCounter++}`;

export const snap = (v: number, cell: number) => Math.round(v / cell) * cell;

// set() 호출 시 히스토리 기록에서 제외할 순수 뷰 키
const VIEW_KEYS = new Set<keyof EditorState>([
  'zoom',
  'selectedId',
  'showTilePreview',
  'tilePreviewRepeat',
]);

interface Actions {
  set: <K extends keyof EditorState>(key: K, value: EditorState[K]) => void;
  setMany: (patch: Partial<EditorState>, label: string) => void;
  totalWidth: () => number;

  // 히스토리
  record: (label: string) => void;
  undo: () => void;
  redo: () => void;

  // 에셋
  addAsset: (a: Omit<Asset, 'id' | 'zIndex'>) => string;
  updateAsset: (id: string, patch: Partial<Asset>, label?: string) => void;
  nudge: (id: string, dx: number, dy: number) => void;
  removeAsset: (id: string) => void;
  select: (id: string | null) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  /** idsTopToBottom: 레이어 패널 표시 순서(맨 위=맨 앞). zIndex 재할당. */
  setLayerOrder: (idsTopToBottom: string[]) => void;
  flipSelected: () => void;

  // 꼬리
  setTail: (patch: Partial<TailConfig>) => void;
  setInsets: (patch: Partial<ContentInsets>) => void;

  // 장식 오버레이 (record 는 스트로크 시작 시 컴포넌트에서 호출)
  applyDeco: (changes: { layer: 'left' | 'mid' | 'right'; key: string; color: string | null }[]) => void;
  clearDeco: () => void;
}

export type Store = EditorState & Actions;

export const useEditor = create<Store>((set, get) => {
  const record = (label: string) => {
    useHistory.getState().record(pickSnapshot(get() as EditorState), label);
  };

  // 스냅샷 복원 + 누락된 에셋 이미지 재로딩
  const restore = (snapd: Snapshot) => {
    const patch: Record<string, unknown> = {};
    for (const k of HISTORY_KEYS) patch[k] = snapd[k];
    set(patch as Partial<EditorState>);
    // 복원된 에셋 중 이미지가 없는 것은 svg로 재생성
    const imgStore = useImages.getState();
    for (const a of snapd.assets) {
      if (!imgStore.images.has(a.id) && a.svg) {
        const url = svgToUrl(a.svg);
        loadImage(url)
          .then((img) => useImages.getState().setImage(a.id, img))
          .catch(() => undefined);
      }
    }
    // 선택이 사라진 에셋을 가리키면 해제
    const ids = new Set(snapd.assets.map((a) => a.id));
    if (get().selectedId && !ids.has(get().selectedId!)) set({ selectedId: null });
  };

  return {
    name: 'redheart',

    cell: 4,
    zoom: 6,

    // 높이 = 허그(상8 + 텍스트12 + 하8). 폰트 12 고정이라 28로 고정.
    height: 28,
    capLeftWidth: 8, // 고정
    capRightWidth: 8, // 고정
    tileWidth: 16, // 고정 (작은 반복 단위)

    strokeColor: '#e7405a',
    fillColor: '#ffd7df',
    strokeWidth: 1,
    lineStyle: 'solid',
    cornerStyle: 'pixelRound',
    cornerRadius: 4,
    dotLength: 1,
    dotGap: 1,

    waveAmp: 3,
    waveLen: 8, // 타일 폭 16의 약수(이음매 안전)
    waveform: 'sine',

    tileMode: 'repeat',
    minWidth: 32, // (좌캡8 + 타일16 + 우캡8) 자동
    contentInsets: { top: 8, right: 8, bottom: 8, left: 8 }, // 상/하 = 허그 패딩 고정

    textColor: '#1b1b1f',
    fontSize: 12,
    bleed: 12,

    deco: { left: {}, mid: {}, right: {} },

    assets: [],
    selectedId: null,

    tail: {
      enabled: true,
      assetId: '__tail__', // 내가 그린 꼬리(고정)
      shape: 'triangle',
      curl: 0.6,
      width: 14,
      height: 9,
      anchorX: 'center',
      offsetX: 0,
      overlap: 3,
    },

    showTilePreview: true,
    tilePreviewRepeat: 4,

    set: (key, value) => {
      if (!VIEW_KEYS.has(key)) record(`set:${String(key)}`);
      set({ [key]: value } as Partial<EditorState>);
    },

    setMany: (patch, label) => {
      record(label);
      set(patch as Partial<EditorState>);
    },

    totalWidth: () => {
      const s = get();
      return s.capLeftWidth + s.tileWidth + s.capRightWidth;
    },

    record,

    undo: () => {
      const present = pickSnapshot(get() as EditorState);
      const prev = useHistory.getState().undo(present);
      if (prev) restore(prev);
    },
    redo: () => {
      const present = pickSnapshot(get() as EditorState);
      const next = useHistory.getState().redo(present);
      if (next) restore(next);
    },

    addAsset: (a) => {
      record('addAsset');
      const id = nextId();
      const maxZ = get().assets.reduce((m, x) => Math.max(m, x.zIndex), 0);
      set((st) => ({
        assets: [...st.assets, { ...a, id, zIndex: maxZ + 1 }],
        selectedId: id,
      }));
      return id;
    },

    updateAsset: (id, patch, label) => {
      record(label ?? `asset:${id}`);
      set((st) => ({
        assets: st.assets.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      }));
    },

    nudge: (id, dx, dy) => {
      record(`nudge:${id}`);
      set((st) => ({
        assets: st.assets.map((x) =>
          x.id === id ? { ...x, x: x.x + dx, y: x.y + dy } : x
        ),
      }));
    },

    removeAsset: (id) => {
      record('removeAsset');
      set((st) => ({
        assets: st.assets.filter((x) => x.id !== id),
        selectedId: st.selectedId === id ? null : st.selectedId,
        tail: st.tail.assetId === id ? { ...st.tail, assetId: null } : st.tail,
      }));
    },

    select: (id) => set({ selectedId: id }),

    bringForward: (id) => {
      record('layer');
      set((st) => {
        const sorted = [...st.assets].sort((a, b) => a.zIndex - b.zIndex);
        const i = sorted.findIndex((x) => x.id === id);
        if (i < 0 || i === sorted.length - 1) return {};
        const z = sorted[i].zIndex;
        sorted[i].zIndex = sorted[i + 1].zIndex;
        sorted[i + 1].zIndex = z;
        return { assets: sorted };
      });
    },

    sendBackward: (id) => {
      record('layer');
      set((st) => {
        const sorted = [...st.assets].sort((a, b) => a.zIndex - b.zIndex);
        const i = sorted.findIndex((x) => x.id === id);
        if (i <= 0) return {};
        const z = sorted[i].zIndex;
        sorted[i].zIndex = sorted[i - 1].zIndex;
        sorted[i - 1].zIndex = z;
        return { assets: sorted };
      });
    },

    setLayerOrder: (idsTopToBottom) => {
      record('reorder');
      set((st) => {
        const n = idsTopToBottom.length;
        // 맨 위(index 0) = 맨 앞(가장 큰 zIndex)
        const zById = new Map(idsTopToBottom.map((id, i) => [id, n - 1 - i]));
        return {
          assets: st.assets.map((a) =>
            zById.has(a.id) ? { ...a, zIndex: zById.get(a.id)! } : a
          ),
        };
      });
    },

    flipSelected: () => {
      record('flip');
      set((st) => ({
        assets: st.assets.map((x) =>
          x.id === st.selectedId ? { ...x, flipX: !x.flipX } : x
        ),
      }));
    },

    setTail: (patch) => {
      record('tail');
      set((st) => ({ tail: { ...st.tail, ...patch } }));
    },
    setInsets: (patch) => {
      record('insets');
      set((st) => ({ contentInsets: { ...st.contentInsets, ...patch } }));
    },

    applyDeco: (changes) =>
      set((st) => {
        const deco = {
          left: { ...st.deco.left },
          mid: { ...st.deco.mid },
          right: { ...st.deco.right },
        };
        for (const ch of changes) {
          if (ch.color === null) delete deco[ch.layer][ch.key];
          else deco[ch.layer][ch.key] = ch.color;
        }
        return { deco };
      }),

    clearDeco: () => {
      record('deco-clear');
      set({ deco: { left: {}, mid: {}, right: {} } });
    },
  };
});

export type { LineStyle, CornerStyle, TileMode };
