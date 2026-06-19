import tailRaw from '../assets/tail/tail.svg?raw';

// 직접 그린 꼬리 픽셀 에셋(흰=채움 / 검정=외곽선 템플릿)
export const BUILTIN_TAIL_ID = '__tail__';
// tail.svg 네이티브는 18×11. 조금 작게 적용(약 80%).
export const BUILTIN_TAIL_SIZE = { w: 14, h: 9 };

export interface TailGrid {
  w: number;
  h: number;
  // 0 = 빈칸, 1 = 채움(흰), 2 = 외곽선(검정)
  data: Uint8Array;
}

// SVG 의 <rect> 들을 빌드 타임(번들 인라인)에 파싱 → 정수 픽셀 그리드.
// (이미지 로드·getImageData·base 경로에 의존하지 않아 어디서나 동기적으로 동작)
let cached: TailGrid | null = null;
export function getTailGrid(): TailGrid {
  if (cached) return cached;
  const sizeM = tailRaw.match(/<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
  const w = sizeM ? +sizeM[1] : 18;
  const h = sizeM ? +sizeM[2] : 11;
  const data = new Uint8Array(w * h);
  const re = /<rect\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  const num = (attrs: string, name: string, def = 0) => {
    const mm = attrs.match(new RegExp(`\\b${name}="([\\d.]+)"`));
    return mm ? Math.round(parseFloat(mm[1])) : def;
  };
  while ((m = re.exec(tailRaw))) {
    const a = m[1];
    const rx = num(a, 'x');
    const ry = num(a, 'y');
    const rw = num(a, 'width', 1);
    const rh = num(a, 'height', 1);
    const fillM = a.match(/fill="([^"]+)"/);
    const isBlack = fillM ? /black|#000|^#0{3,6}$/i.test(fillM[1]) : false;
    const v = isBlack ? 2 : 1;
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) data[y * w + x] = v;
      }
    }
  }
  cached = { w, h, data };
  return cached;
}
