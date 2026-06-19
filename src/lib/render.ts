import type { Asset, EditorState, LineStyle, Waveform } from '../types';
import { BUILTIN_TAIL_ID, getTailGrid } from './builtinTail';
import { renderDecoCanvas } from './deco';

export interface FrameModel {
  height: number;
  totalWidth: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  cornerStyle: 'square' | 'pixelRound' | 'round';
  cornerRadius: number;
  dotLength: number;
  dotGap: number;
  waveAmp: number;
  waveLen: number;
  waveform: Waveform;
}

// ---- 색 파싱 ----
export function hexToRgba(hex: string): [number, number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 6) h += 'ff';
  const n = parseInt(h, 16);
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

export function dotPeriod(dotLength: number, dotGap: number): number {
  return Math.max(1, Math.round(dotLength) + Math.round(dotGap));
}

// 점선 on/off (절대 x 위상). dotted 외엔 항상 on(solid).
function dashOn(m: FrameModel, x: number): boolean {
  if (m.lineStyle !== 'dotted') return true;
  const on = Math.max(1, Math.round(m.dotLength));
  const period = dotPeriod(m.dotLength, m.dotGap);
  return ((x % period) + period) % period < on;
}

// 모서리 가로 인셋: 계단(직선 챔퍼) 또는 원형(사분원)
function chamfer(m: FrameModel, y: number): number {
  const r = m.cornerRadius;
  if (r <= 0 || m.cornerStyle === 'square') return 0;
  const d = Math.min(y, m.height - 1 - y);
  if (d >= r) return 0;
  if (m.cornerStyle === 'round') {
    // 사분원: 반지름 r 원호를 정수 그리드에 래스터화
    const vy = r - d - 0.5; // 원 중심(엣지에서 r)으로부터의 세로 거리
    const half = Math.sqrt(Math.max(0, r * r - vy * vy));
    return Math.max(0, Math.ceil(r - half));
  }
  // pixelRound: 직선 계단(대각 챔퍼)
  return r - d;
}

function inShape(m: FrameModel, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= m.totalWidth || y >= m.height) return false;
  const ins = chamfer(m, y);
  return x >= ins && x < m.totalWidth - ins;
}

// 위/아래/좌/우로 바깥(non-shape)까지의 거리(최대 sw+1까지만 측정)
function distToOutside(
  m: FrameModel,
  x: number,
  y: number,
  dx: number,
  dy: number,
  max: number
): number {
  for (let k = 1; k <= max; k++) {
    if (!inShape(m, x + dx * k, y + dy * k)) return k;
  }
  return max + 1;
}

/**
 * 프레임을 "디자인 픽셀" 해상도(totalWidth × height)로 정확히 래스터화한다.
 * 반환 캔버스는 1배율. 표시/내보내기 시 정수 배율 nearest-neighbor 확대.
 */
export function renderFrameCanvas(m: FrameModel): HTMLCanvasElement {
  if (m.lineStyle === 'wave') return renderWaveFrame(m);
  const W = m.totalWidth;
  const H = m.height;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  const stroke = hexToRgba(m.strokeColor);
  const fill = hexToRgba(m.fillColor);
  const sw = Math.max(1, Math.min(4, m.strokeWidth));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inShape(m, x, y)) continue;
      const idx = (y * W + x) * 4;

      const up = distToOutside(m, x, y, 0, -1, sw);
      const down = distToOutside(m, x, y, 0, 1, sw);
      const left = distToOutside(m, x, y, -1, 0, sw);
      const right = distToOutside(m, x, y, 1, 0, sw);
      const minVert = Math.min(up, down);
      const minHoriz = Math.min(left, right);

      const isBorder = minVert <= sw || minHoriz <= sw;

      let color = fill;
      let draw = true;

      if (isBorder) {
        // 수직(좌/우) 모서리에 더 가까우면 항상 실선 처리, 아니면 가로선 → 점선 적용
        const verticalEdge = minHoriz <= sw && minHoriz <= minVert;
        if (verticalEdge) {
          color = stroke;
        } else {
          if (dashOn(m, x)) {
            color = stroke;
          } else {
            // 가로선의 off 픽셀: 바깥쪽(테두리 최외곽)이면 비우고, 안쪽이면 채움색 유지
            const outermost = minVert <= 1;
            if (outermost) draw = false;
            else color = fill;
          }
        }
      }

      if (!draw) continue;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = color[3];
    }
  }

  ctx.putImageData(img, 0, 0);
  return cv;
}

/**
 * 절대 x 위상 기준 물결 세로 변위(0..amp, 정수 픽셀 계단).
 * x=0 에서 위상 0(가장자리가 맨 위/맨 아래에 붙음).
 * waveLen 이 tileWidth 의 약수이면 한 주기가 정수로 맞아 타일 반복 시 이음매가 없다.
 */
export function waveInset(x: number, amp: number, len: number, form: Waveform): number {
  if (amp <= 0 || len <= 0) return 0;
  const t = ((x % len) + len) % len; // 0..len
  let u: number; // 0..1 정규화 변위
  if (form === 'zigzag') {
    const p = t / len; // 0..1
    u = p < 0.5 ? p * 2 : (1 - p) * 2; // 삼각파 0..1..0
  } else {
    // 사인 (둥근 계단): 0..1..0
    u = (1 - Math.cos((t / len) * Math.PI * 2)) / 2;
  }
  return Math.round(u * amp);
}

/**
 * 물결 테두리 프레임. 상/하 가장자리가 물결을 따라 흔들리고(실루엣도 따라감),
 * 좌/우 캡 세로 테두리는 직선. 기존과 동일한 정수 픽셀 래스터 파이프라인.
 * (cornerStyle 은 무시 — 물결이 장식 역할)
 */
function renderWaveFrame(m: FrameModel): HTMLCanvasElement {
  const W = m.totalWidth;
  const H = m.height;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  const stroke = hexToRgba(m.strokeColor);
  const fill = hexToRgba(m.fillColor);
  const sw = Math.max(1, Math.min(4, m.strokeWidth));
  const amp = Math.max(0, Math.round(m.waveAmp));
  const len = Math.max(1, Math.round(m.waveLen));

  for (let x = 0; x < W; x++) {
    const inset = waveInset(x, amp, len, m.waveform);
    const top = inset; // 채워지는 영역의 시작 y
    const bot = H - 1 - inset; // 끝 y (상/하 동일 위상 → 리본형 물결)
    if (bot < top) continue;

    const leftEdge = x < sw;
    const rightEdge = x >= W - sw;

    for (let y = top; y <= bot; y++) {
      const topStroke = y < top + sw;
      const botStroke = y > bot - sw;
      const isStroke = topStroke || botStroke || leftEdge || rightEdge;
      const c = isStroke ? stroke : fill;
      const idx = (y * W + x) * 4;
      data[idx] = c[0];
      data[idx + 1] = c[1];
      data[idx + 2] = c[2];
      data[idx + 3] = c[3];
    }
  }

  ctx.putImageData(img, 0, 0);
  return cv;
}

// ---- 정수 배율 nearest-neighbor 확대 ----
export function scaleCanvas(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width * scale;
  out.height = src.height * scale;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

export function cropCanvas(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
  return out;
}

/** 에셋 1개를 design 캔버스에 변환 적용해 그린다 (tail 제외 여부는 호출측에서 필터) */
function drawAsset(
  ctx: CanvasRenderingContext2D,
  asset: Asset,
  img: HTMLImageElement
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false; // 투명도는 알파 곱연산 — 스무딩 없이 크리스프 유지
  ctx.globalAlpha = asset.opacity ?? 1;
  const cx = asset.x + asset.width / 2;
  const cy = asset.y + asset.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate((asset.rotation * Math.PI) / 180);
  if (asset.flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -asset.width / 2, -asset.height / 2, asset.width, asset.height);
  ctx.restore();
}

export interface BubbleRenderOpts {
  includeTail?: boolean;
  images: Map<string, HTMLImageElement>;
  /** 프레임 바깥 블리드(px). 캔버스가 (W+2B)×(H+2B)로 커지고 프레임은 (B,B)에 그려진다. */
  bleed?: number;
}

/** 프레임 + 에셋을 design 해상도로 합성 (꼬리 에셋은 includeTail=false면 제외) */
export function renderBubbleDesign(
  state: EditorState,
  opts: BubbleRenderOpts
): HTMLCanvasElement {
  const totalWidth = state.capLeftWidth + state.tileWidth + state.capRightWidth;
  const B = Math.max(0, Math.round(opts.bleed ?? 0));
  const frame = renderFrameCanvas({
    height: state.height,
    totalWidth,
    strokeColor: state.strokeColor,
    fillColor: state.fillColor,
    strokeWidth: state.strokeWidth,
    lineStyle: state.lineStyle,
    cornerStyle: state.cornerStyle,
    cornerRadius: state.cornerRadius,
    dotLength: state.dotLength,
    dotGap: state.dotGap,
    waveAmp: state.waveAmp,
    waveLen: state.waveLen,
    waveform: state.waveform,
  });

  const cv = document.createElement('canvas');
  cv.width = totalWidth + B * 2;
  cv.height = state.height + B * 2;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame, B, B);

  const tailId = state.tail.enabled ? state.tail.assetId : '__none__';
  const sorted = [...state.assets].sort((a, b) => a.zIndex - b.zIndex);
  for (const a of sorted) {
    if (a.hidden) continue;
    if (!opts.includeTail && a.id === tailId) continue;
    const img = opts.images.get(a.id);
    if (img && img.complete) {
      // 프레임 기준 좌표 → 블리드 오프셋만큼 평행이동
      drawAsset(ctx, { ...a, x: a.x + B, y: a.y + B }, img);
    }
  }

  // 장식 오버레이(비파괴): 맨 위에 합성. 캔버스 크기/원점이 동일해 그대로 덮어그림.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(renderDecoCanvas(state), 0, 0);

  return cv;
}

/**
 * "나선" 꼬리(레퍼런스 예각형) 채움 그리드:
 *  - 좌변 수직 + 우변 완만한 사선 → 왼쪽 아래로 날카로운 예각 끝점(비대칭 예각)
 *  - 끝점에 연결된 작은 계단형 갈고리(살짝 말린 디테일, 고정)
 *  정수 그리드 픽셀 칸 채움(부드러운 곡선 아님). 입구(y<overlap)는 호출측에서 full-width 처리.
 */
function buildSpiralFill(w: number, h: number, overlap: number): Uint8Array {
  const grid = new Uint8Array(w * h);
  const set = (x: number, y: number) => {
    if (x >= 0 && x < w && y >= 0 && y < h) grid[y * w + x] = 1;
  };
  const stamp = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) set(x, y);
      }
    }
  };

  const H = h - 1;
  const denom = Math.max(1, H - overlap);
  // 본체: 입구(full width) → 왼쪽아래 예각 끝. 좌변 수직, 우변 완만한 사선.
  for (let y = overlap; y < h; y++) {
    const p = (y - overlap) / denom;
    const xR = Math.max(1, Math.round(w * (1 - 0.92 * p)));
    for (let x = 0; x < xR; x++) grid[y * w + x] = 1;
  }

  // 끝 갈고리: 좌하단 팁에서 오른쪽-위로 살짝 말리는 작은 호(연결, 고정 크기)
  const T = [0.5, h - 1.5];
  const C = [T[0] + 2.0, T[1] - 1.1];
  const R = 2.1;
  for (let a = Math.PI * 1.05; a >= -Math.PI * 0.35; a -= 0.15) {
    stamp(C[0] + R * Math.cos(a), C[1] + R * Math.sin(a), 1.0);
  }
  return grid;
}

/** 꼬리를 tail.width × tail.height design 캔버스로 렌더 */
export function renderTailDesign(
  state: EditorState,
  images: Map<string, HTMLImageElement>
): HTMLCanvasElement {
  const w = Math.max(1, state.tail.width);
  const h = Math.max(1, state.tail.height);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const id = state.tail.assetId;
  const a = id ? state.assets.find((x) => x.id === id) : undefined;
  const img = a ? images.get(a.id) : undefined;
  const isBuiltinTail = id === BUILTIN_TAIL_ID;

  if (isBuiltinTail) {
    // 직접 그린 2색 템플릿(흰=채움 / 검정=외곽선)을 말풍선 색으로 재색 → 본체와 연결.
    // SVG rect 파싱 그리드를 동기 렌더(이미지 로드/네트워크 의존 없음).
    const grid = getTailGrid();
    const nat = document.createElement('canvas');
    nat.width = grid.w;
    nat.height = grid.h;
    const nctx = nat.getContext('2d')!;
    nctx.imageSmoothingEnabled = false;
    for (let gy = 0; gy < grid.h; gy++) {
      for (let gx = 0; gx < grid.w; gx++) {
        const v = grid.data[gy * grid.w + gx];
        if (!v) continue;
        nctx.fillStyle = v === 2 ? state.strokeColor : state.fillColor;
        nctx.fillRect(gx, gy, 1, 1);
      }
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(nat, 0, 0, grid.w, grid.h, 0, 0, w, h); // 정수 nearest 스케일
  } else if (a && img && img.complete) {
    // 업로드한 일반 에셋 꼬리: 원본 색 그대로
    ctx.save();
    if (a.flipX) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
  } else {
    // 생성형 꼬리: 입구(윗변) 무선 + neck 채움(본체 바닥선 덮기) + 측면/끝 연속 외곽선
    const overlap = Math.max(0, Math.round(state.tail.overlap));
    const sw = Math.max(1, Math.min(4, state.strokeWidth));
    const shape = state.tail.shape ?? 'triangle';
    const stroke = hexToRgba(state.strokeColor);
    const fill = hexToRgba(state.fillColor);

    // 나선(spiral): 레퍼런스 예각형 + 끝 갈고리(고정 모양)
    let spiralGrid: Uint8Array | null = null;
    if (shape === 'spiral') {
      spiralGrid = buildSpiralFill(w, h, overlap);
    }

    // 꼬리 내부 판정 (y<overlap 은 입구=전체폭, 그 아래는 모양대로)
    const inside = (x: number, y: number): boolean => {
      if (x < 0 || x >= w || y < 0 || y >= h) return false;
      if (y < overlap) return true; // 입구(neck): 전체 폭
      if (spiralGrid) return spiralGrid[y * w + x] === 1;
      const denom = Math.max(1, h - 1 - overlap);
      const p = Math.min(1, (y - overlap) / denom); // 0..1
      if (shape === 'asymmetric') {
        // 오른쪽에서 완만히 내려와 왼쪽 아래로 예각: 좌변 수직(x=0), 우변 사선
        const xR = Math.max(1, Math.round(w * (1 - p)));
        return x >= 0 && x < xR;
      }
      // 삼각형(중앙 대칭)
      const half = (w / 2) * (1 - p);
      let xL = Math.round(w / 2 - half);
      let xR = Math.round(w / 2 + half);
      if (xR <= xL) xR = xL + 1; // 최소 1px tip
      return x >= xL && x < xR;
    };

    const strokeStart = Math.max(0, overlap - sw); // 본체 바닥선 행부터 측면 외곽선 시작(코너 연결)
    const img2 = ctx.createImageData(w, h);
    const d = img2.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        // 윗변(입구)은 절대 stroke 안 함 → 위쪽이 바깥이어도 무시
        const outLeft = !inside(x - 1, y);
        const outRight = !inside(x + 1, y);
        const outDown = !inside(x, y + 1);
        const isStroke = y >= strokeStart && (outLeft || outRight || outDown);
        const c = isStroke ? stroke : fill;
        const idx = (y * w + x) * 4;
        d[idx] = c[0];
        d[idx + 1] = c[1];
        d[idx + 2] = c[2];
        d[idx + 3] = c[3];
      }
    }
    ctx.putImageData(img2, 0, 0);
  }

  return cv;
}
