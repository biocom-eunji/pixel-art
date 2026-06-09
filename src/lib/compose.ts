import type { EditorState } from '../types';
import { cropCanvas, renderBubbleDesign, renderTailDesign } from './render';

/** 말풍선 텍스트 폰트(Medium 500, Pretendard → Noto Sans KR 폴백) */
export const BUBBLE_FONT_FAMILY = "'Pretendard','Noto Sans KR',sans-serif";
export const bubbleFont = (px: number) => `500 ${px}px ${BUBBLE_FONT_FAMILY}`;

export interface ComposedBubble {
  canvas: HTMLCanvasElement; // 디자인 해상도 스프라이트(블리드 포함, 텍스트 제외)
  width: number; // 캔버스 전체 폭(블리드 포함, 디자인 px)
  height: number; // 캔버스 전체 높이(블리드+꼬리 포함, 디자인 px)
  frameWidth: number; // 프레임(블리드 제외) 폭
  frameHeight: number; // 프레임 높이
  bleed: number; // 블리드 px (프레임은 캔버스 (B,B)에 위치)
  // 텍스트는 표시 단계에서 또렷하게 렌더 (위치/크기만)
  text: string;
  textColor: string;
  fontPx: number;
  textCx: number; // 텍스트 중심 x (캔버스 좌표, 블리드 포함)
  textCy: number;
}

/**
 * RN <PixelBubble> 합성 + 블리드:
 *  - 좌캡(좌+상하 블리드) / 가운데 타일(상하 블리드만, 텍스트 폭만큼 신축) / 우캡(우+상하 블리드)
 *  - 하단 중앙 꼬리(아래로 향함)
 *  - 스프라이트는 디자인 해상도, 텍스트는 위치/크기만 반환(표시 시 또렷하게).
 */
export function composeBubbleDesign(
  s: EditorState,
  images: Map<string, HTMLImageElement>,
  text: string
): ComposedBubble {
  const B = Math.max(0, Math.round(s.bleed));
  const baseW = s.capLeftWidth + s.tileWidth + s.capRightWidth;

  // 블리드 포함 디자인(프레임 (B,B)) → 조각 추출
  const design = renderBubbleDesign(s, { images, includeTail: false, bleed: B });
  const Hb = s.height + B * 2; // 조각 높이(상/하 블리드 포함)
  const left = cropCanvas(design, 0, 0, s.capLeftWidth + B, Hb); // 좌블리드+캡
  const mid = cropCanvas(design, B + s.capLeftWidth, 0, s.tileWidth, Hb); // 타일(좌우 블리드 없음)
  const right = cropCanvas(design, B + s.capLeftWidth + s.tileWidth, 0, s.capRightWidth + B, Hb);

  // 텍스트 폭 측정
  const meas = document.createElement('canvas').getContext('2d')!;
  const contentH = Math.max(1, s.height - s.contentInsets.top - s.contentInsets.bottom);
  const fontPx = Math.max(5, Math.round(s.fontSize));
  meas.font = bubbleFont(fontPx);
  const textW = text ? meas.measureText(text).width : 0;

  const fixed = s.capLeftWidth + s.capRightWidth + s.contentInsets.left + s.contentInsets.right;
  const autoMin = baseW;
  const FW = Math.max(autoMin, Math.ceil(fixed + textW)); // 프레임 폭(블리드 제외)
  const midDesignW = Math.max(s.tileWidth, FW - s.capLeftWidth - s.capRightWidth);

  const tail = s.tail.enabled ? renderTailDesign(s, images) : null;
  const tailStickOut = tail ? Math.max(0, tail.height - s.tail.overlap) : 0;

  const W = FW + B * 2;
  const H = B + s.height + Math.max(B, tailStickOut); // 상단 블리드 + 프레임 + (하단 블리드 or 꼬리)

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // 좌캡 (x=0, 상단 정렬: 조각 자체가 상/하 블리드 포함)
  ctx.drawImage(left, 0, 0);
  const midStart = s.capLeftWidth + B; // 캔버스 좌표에서 타일 시작
  if (s.tileMode === 'stretch') {
    ctx.drawImage(mid, midStart, 0, midDesignW, Hb);
  } else {
    let x = midStart;
    const end = midStart + midDesignW;
    while (x < end) {
      const w = Math.min(mid.width, end - x);
      ctx.drawImage(mid, 0, 0, w, mid.height, x, 0, w, mid.height);
      x += mid.width;
    }
  }
  ctx.drawImage(right, midStart + midDesignW, 0);

  // 꼬리 (프레임 기준 좌표 + 블리드 오프셋)
  if (tail) {
    const txFrame = s.tail.anchorX === 'center' ? Math.round(FW / 2 - tail.width / 2) : s.tail.offsetX;
    ctx.drawImage(tail, txFrame + B, s.height - s.tail.overlap + B);
  }

  // 텍스트 중심(캔버스 좌표)
  const cxStart = s.capLeftWidth + s.contentInsets.left;
  const cxEnd = s.capLeftWidth + midDesignW - s.contentInsets.right;
  const textCx = (cxStart + cxEnd) / 2 + B;
  const textCy = s.contentInsets.top + contentH / 2 + B;

  return {
    canvas: cv,
    width: W,
    height: H,
    frameWidth: FW,
    frameHeight: s.height,
    bleed: B,
    text,
    textColor: s.textColor,
    fontPx,
    textCx,
    textCy,
  };
}
