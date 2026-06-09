import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { EditorState } from '../types';
import { buildManifest } from './manifest';
import { buildPixelBubbleTsx, buildUsageExample } from './rnComponent';
import {
  cropCanvas,
  dotPeriod,
  renderBubbleDesign,
  renderTailDesign,
  scaleCanvas,
} from './render';

const SCALES = [1, 2, 3] as const;

function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 실패'))), 'image/png');
  });
}

export interface SliceWarning {
  message: string;
}

/** 슬라이스 정합성 검사: 타일/캡 폭이 0 이상 정수, dash 주기 정합 등 */
export function validate(s: EditorState): SliceWarning[] {
  const w: SliceWarning[] = [];
  if (s.tileWidth < 1) w.push({ message: '타일 폭이 1px 미만입니다.' });
  if (s.capLeftWidth < 1) w.push({ message: '좌캡 폭이 1px 미만입니다.' });
  if (s.capRightWidth < 1) w.push({ message: '우캡 폭이 1px 미만입니다.' });
  if (s.lineStyle === 'dotted') {
    const period = dotPeriod(s.dotLength, s.dotGap);
    if (period > 1 && s.tileWidth % period !== 0) {
      w.push({
        message: `타일 폭(${s.tileWidth})이 점선 주기(점 ${s.dotLength}+간격 ${s.dotGap}=${period})의 배수가 아닙니다. 반복 시 이음매가 보일 수 있습니다.`,
      });
    }
  }
  if (s.lineStyle === 'wave') {
    if (s.tileWidth % s.waveLen !== 0) {
      w.push({
        message: `타일 폭(${s.tileWidth})이 파장(${s.waveLen})의 배수가 아닙니다. 물결 반복 시 이음매가 보입니다. "타일폭을 파장 배수로" 버튼으로 보정하세요.`,
      });
    }
    if (s.waveAmp + s.strokeWidth > s.contentInsets.top) {
      w.push({
        message: `진폭(${s.waveAmp})+선두께(${s.strokeWidth})가 상단 여백(${s.contentInsets.top})보다 큽니다. 물결이 콘텐츠를 침범할 수 있어 상단 여백을 늘리세요.`,
      });
    }
    if (s.waveAmp * 2 + s.strokeWidth * 2 >= s.height) {
      w.push({ message: `진폭이 높이에 비해 큽니다. 상/하 물결이 겹칩니다.` });
    }
  }
  if (s.tail.enabled && !s.tail.assetId && s.tail.overlap < s.strokeWidth) {
    w.push({
      message: `꼬리 겹침(overlap ${s.tail.overlap})이 선 두께(${s.strokeWidth})보다 작아 꼬리 입구에 본체 바닥선이 비칠 수 있습니다. overlap을 ${s.strokeWidth} 이상으로 두세요.`,
    });
  }
  // minWidth 는 (좌캡+타일+우캡)으로 자동 계산되므로 "전체폭<minWidth" 경고는 발생하지 않음
  return w;
}

export async function exportZip(
  state: EditorState,
  images: Map<string, HTMLImageElement>
) {
  const zip = new JSZip();
  const { capLeftWidth, tileWidth, capRightWidth, height } = state;
  const B = Math.max(0, Math.round(state.bleed));

  // 1x design 합성 (블리드 포함, 꼬리 에셋 제외). 프레임은 (B,B)에 위치.
  const design = renderBubbleDesign(state, { images, includeTail: false, bleed: B });
  const tailDesign = state.tail.enabled ? renderTailDesign(state, images) : null;

  for (const scale of SCALES) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    const full = scaleCanvas(design, scale);
    const H = (height + B * 2) * scale; // 조각 높이(상/하 블리드 포함)

    // 좌캡 = 좌측 블리드 + 캡 (+상/하 블리드)
    const left = cropCanvas(full, 0, 0, (capLeftWidth + B) * scale, H);
    // 타일 = 정확히 1주기 (상/하 블리드만, 좌우 블리드 없음 → 반복 안전)
    const mid = cropCanvas(full, (B + capLeftWidth) * scale, 0, tileWidth * scale, H);
    // 우캡 = 캡 + 우측 블리드 (+상/하 블리드)
    const right = cropCanvas(
      full,
      (B + capLeftWidth + tileWidth) * scale,
      0,
      (capRightWidth + B) * scale,
      H
    );

    zip.file(`left${suffix}.png`, await canvasToBlob(left));
    zip.file(`mid${suffix}.png`, await canvasToBlob(mid));
    zip.file(`right${suffix}.png`, await canvasToBlob(right));

    if (tailDesign) {
      const tail = scaleCanvas(tailDesign, scale);
      zip.file(`tail${suffix}.png`, await canvasToBlob(tail));
    }
  }

  // manifest + RN 컴포넌트 + 사용예시
  const manifest = buildManifest(state);
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('PixelBubble.tsx', buildPixelBubbleTsx(state, manifest));
  zip.file('Demo.example.tsx', buildUsageExample());
  zip.file(
    'README.txt',
    `Pixel Bubble export — "${state.name}"\n\n` +
      `포함: left/mid/right(.png @1x,@2x,@3x)${tailDesign ? ', tail(.png ...)' : ''}, manifest.json, PixelBubble.tsx\n` +
      `RN 프로젝트에 폴더째 복사 후 <PixelBubble>로 감싸 사용하세요.\n` +
      `mid.png 는 정확히 타일 1주기(${tileWidth}px) 폭으로 잘렸으며 가로 repeat 시 이음매가 없습니다.\n` +
      (B > 0
        ? `블리드 ${B}px: 좌캡=좌+상하, 우캡=우+상하, 타일=상하 블리드를 투명 여백으로 포함합니다. ` +
          `RN 에서는 음수 오프셋 + overflow:'visible' 로 프레임 밖 장식이 보입니다(레이아웃은 프레임 기준).\n`
        : '')
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${state.name || 'bubble'}-pixelbubble.zip`);
}
