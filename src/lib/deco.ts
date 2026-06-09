import type { DecoSeg, EditorState } from '../types';

// 장식 좌표계:
//  - 프레임 좌표(fx,fy): 자동 말풍선 좌상단 = (0,0). 블리드로 음수/초과 허용.
//  - 각 구간 레이어는 export 슬라이스와 동일한 크기:
//      left  = (capLeft + B) × (H + 2B), 레이어(0,0) ↔ 프레임(-B, -B)
//      mid   = tile        × (H + 2B), 레이어 x 는 (fx-capLeft) mod tile (가로 wrap)
//      right = (capRight + B) × (H + 2B), 레이어(0,0) ↔ 프레임(capLeft+tile, -B)

export function bleedPx(s: EditorState): number {
  return Math.max(0, Math.round(s.bleed));
}

export function decoDims(s: EditorState) {
  const B = bleedPx(s);
  const H = s.height;
  return {
    left: { w: s.capLeftWidth + B, h: H + 2 * B },
    mid: { w: s.tileWidth, h: H + 2 * B },
    right: { w: s.capRightWidth + B, h: H + 2 * B },
  } as const;
}

export interface DecoHit {
  layer: DecoSeg;
  lx: number;
  ly: number;
}

/** 프레임 픽셀 → 구간/레이어 로컬 좌표 (블리드 범위 밖이면 null) */
export function frameToDeco(s: EditorState, fx: number, fy: number): DecoHit | null {
  const B = bleedPx(s);
  const H = s.height;
  const totalW = s.capLeftWidth + s.tileWidth + s.capRightWidth;
  if (fy < -B || fy >= H + B) return null;
  if (fx < -B || fx >= totalW + B) return null;
  const ly = fy + B;
  if (ly < 0 || ly >= H + 2 * B) return null;

  if (fx < s.capLeftWidth) {
    return { layer: 'left', lx: fx + B, ly };
  }
  if (fx < s.capLeftWidth + s.tileWidth) {
    const t = s.tileWidth;
    const lx = (((fx - s.capLeftWidth) % t) + t) % t;
    return { layer: 'mid', lx, ly };
  }
  return { layer: 'right', lx: fx - (s.capLeftWidth + s.tileWidth), ly };
}

/** 레이어 로컬 좌표 → 블리드 design 캔버스 좌표(프레임이 (B,B)에 있는 캔버스) */
function decoToCanvas(s: EditorState, layer: DecoSeg, lx: number, ly: number): [number, number] {
  const B = bleedPx(s);
  if (layer === 'left') return [lx, ly]; // 프레임(-B,-B) → 캔버스(0,0)
  if (layer === 'mid') return [B + s.capLeftWidth + lx, ly];
  return [B + s.capLeftWidth + s.tileWidth + lx, ly];
}

/**
 * 장식 오버레이를 블리드 design 캔버스 크기((totalW+2B)×(H+2B))로 렌더.
 * 타일은 1칸만 그려짐(슬라이스/미리보기에서 자연 반복).
 */
export function renderDecoCanvas(s: EditorState): HTMLCanvasElement {
  const B = bleedPx(s);
  const totalW = s.capLeftWidth + s.tileWidth + s.capRightWidth;
  const cv = document.createElement('canvas');
  cv.width = totalW + 2 * B;
  cv.height = s.height + 2 * B;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  (['left', 'mid', 'right'] as DecoSeg[]).forEach((layer) => {
    const map = s.deco[layer];
    for (const key in map) {
      const [lxs, lys] = key.split(',');
      const lx = +lxs;
      const ly = +lys;
      const [cx, cy] = decoToCanvas(s, layer, lx, ly);
      ctx.fillStyle = map[key];
      ctx.fillRect(cx, cy, 1, 1);
    }
  });
  return cv;
}
