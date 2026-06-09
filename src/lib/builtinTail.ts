import tailUrl from '../assets/tail/tail.svg?url';
import { loadImage } from './svg';

// 직접 그린 꼬리 픽셀 에셋(흰=채움 / 검정=외곽선 템플릿)
export const BUILTIN_TAIL_ID = '__tail__';
// tail.svg 네이티브는 18×11. 조금 작게 적용(약 80%).
export const BUILTIN_TAIL_SIZE = { w: 14, h: 9 };

export function loadBuiltinTail(): Promise<HTMLImageElement> {
  return loadImage(tailUrl);
}
