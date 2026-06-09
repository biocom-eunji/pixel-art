import { create } from 'zustand';

// 인앱 미리보기 전용 상태 (export/manifest 에 영향 없음)
interface InAppStore {
  bgImg: HTMLImageElement | null;
  bgUrl: string | null;
  bgW: number;
  bgH: number;
  bgOn: boolean; // 배경 표시 on/off (off = 옛 RN 합성 미리보기 역할)
  text: string;
  x: number; // 배경 픽셀 좌표 기준 말풍선 좌상단
  y: number;
  scale: number; // 정수 배율
  placed: boolean; // 기본 위치 설정 완료 여부
  fitNonce: number; // 편집 캔버스 Fit 트리거(새로 만들기/열기 시 증가)
  bumpFit: () => void;
  setBg: (img: HTMLImageElement, url: string) => void;
  setBgOn: (v: boolean) => void;
  setText: (t: string) => void;
  setPos: (x: number, y: number) => void;
  setScale: (s: number) => void;
  setPlaced: (v: boolean) => void;
}

export const useInApp = create<InAppStore>((set) => ({
  bgImg: null,
  bgUrl: null,
  bgW: 0,
  bgH: 0,
  bgOn: true,
  text: '뭐하다 이제왔냥',
  x: 0,
  y: 0,
  scale: 3,
  placed: false,
  fitNonce: 0,
  bumpFit: () => set((st) => ({ fitNonce: st.fitNonce + 1 })),
  setBg: (img, url) => set({ bgImg: img, bgUrl: url, bgW: img.naturalWidth, bgH: img.naturalHeight, bgOn: true }),
  setBgOn: (bgOn) => set({ bgOn }),
  setText: (text) => set({ text }),
  setPos: (x, y) => set({ x, y }),
  setScale: (scale) => set({ scale: Math.max(1, Math.min(16, Math.round(scale))) }),
  setPlaced: (placed) => set({ placed }),
}));
