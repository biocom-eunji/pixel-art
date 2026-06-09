// 모든 좌표/크기는 "디자인 픽셀"(픽셀아트 1배율) 단위의 정수다.
// 내보낼 때 @1x/@2x/@3x 로 스케일하여 래스터화한다.

/** 장식 오버레이: 구간별 픽셀 맵. 키 "x,y"(레이어 로컬 정수 좌표) → hex 색 */
export type DecoSeg = 'left' | 'mid' | 'right';
export type DecoLayer = Record<string, string>;
export type DecoLayers = { left: DecoLayer; mid: DecoLayer; right: DecoLayer };

export type LineStyle = 'solid' | 'dotted' | 'wave';
export type Waveform = 'sine' | 'zigzag';
export type CornerStyle = 'square' | 'pixelRound' | 'round';
export type TileMode = 'repeat' | 'stretch';
export type AnchorX = 'center' | 'left';

export interface Asset {
  id: string;
  name: string;
  /** SVG 원본 텍스트 (재래스터화에 사용) */
  svg: string;
  /** object URL (썸네일/Konva 표시용) */
  url: string;
  /** 좌상단 기준 위치(디자인 px) */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // deg
  flipX: boolean;
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  /** 0~1, 기본 1 */
  opacity?: number;
}

export interface ContentInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type TailShape = 'triangle' | 'asymmetric' | 'spiral';

export interface TailConfig {
  enabled: boolean;
  /** 꼬리로 사용할 에셋 id. 없으면 shape 프리셋으로 생성 */
  assetId: string | null;
  /** 생성형 꼬리 모양 (assetId 가 없을 때 사용) */
  shape: TailShape;
  /** 나선 말림 정도 (0~1.5, spiral 일 때) */
  curl?: number;
  width: number;
  height: number;
  anchorX: AnchorX;
  /** anchorX === 'left' 일 때 왼쪽으로부터의 오프셋 px */
  offsetX: number;
  /** 프레임과 겹치는 px */
  overlap: number;
}

export interface EditorState {
  name: string;

  // 그리드/줌
  cell: number; // 픽셀 스냅 셀 크기 (기본 4)
  zoom: number; // 에디터 표시 배율

  // 프레임 (세로 고정, 가로 = capLeft + tile + capRight)
  height: number;
  capLeftWidth: number;
  capRightWidth: number;
  tileWidth: number;

  strokeColor: string;
  fillColor: string;
  strokeWidth: number; // 1~4
  lineStyle: LineStyle;
  cornerStyle: CornerStyle;
  cornerRadius: number; // pixelRound=계단 크기 / round=반지름 (px)

  // 점선 파라미터 (px)
  dotLength: number; // 점 길이
  dotGap: number; // 간격

  // 물결(wave) 선 스타일 파라미터
  waveAmp: number; // 진폭 (px) — 상/하 가장자리가 흔들리는 세로 범위
  waveLen: number; // 파장 (px) — 한 주기 가로 길이
  waveform: Waveform;

  tileMode: TileMode;
  minWidth: number;
  contentInsets: ContentInsets;

  // 텍스트
  textColor: string;
  fontSize: number;

  // 블리드: 프레임 바깥으로 에셋이 넘쳐도 보이는 여유(px). 캡엔 좌우+상하, 타일엔 상하만 적용.
  bleed: number;

  // 장식 오버레이(비파괴): 구간별 픽셀 맵 "x,y"->hex. 타일은 1칸만 저장→반복.
  deco: DecoLayers;

  // 에셋 & 선택
  assets: Asset[];
  selectedId: string | null;

  // 꼬리
  tail: TailConfig;

  // 미리보기
  showTilePreview: boolean;
  tilePreviewRepeat: number;
}

export interface Manifest {
  name: string;
  height: number;
  capLeftWidth: number;
  capRightWidth: number;
  tileWidth: number;
  tileMode: TileMode;
  minWidth: number;
  contentInsets: ContentInsets;
  textColor: string;
  fontSize: number;
  /** 프레임 바깥 블리드(px) — 조각 PNG에 투명 여백으로 포함됨 */
  bleed: number;
  tail: {
    width: number;
    height: number;
    anchorX: AnchorX;
    overlap: number;
  };
}
