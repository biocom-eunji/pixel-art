import type { EditorState, Manifest } from '../types';

/** minWidth = (좌캡 + 타일 + 우캡) 자동 계산 (자연 최소 폭) */
export function autoMinWidth(s: EditorState): number {
  return s.capLeftWidth + s.tileWidth + s.capRightWidth;
}

export function buildManifest(s: EditorState): Manifest {
  return {
    name: s.name,
    height: s.height,
    capLeftWidth: s.capLeftWidth,
    capRightWidth: s.capRightWidth,
    tileWidth: s.tileWidth,
    tileMode: s.tileMode,
    minWidth: autoMinWidth(s),
    contentInsets: { ...s.contentInsets },
    textColor: s.textColor,
    fontSize: s.fontSize,
    bleed: s.bleed,
    tail: {
      width: s.tail.width,
      height: s.tail.height,
      anchorX: s.tail.anchorX,
      overlap: s.tail.overlap,
    },
  };
}
