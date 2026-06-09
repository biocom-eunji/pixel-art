import { saveAs } from 'file-saver';
import type { EditorState } from '../types';
import { useEditor } from '../store/editorStore';
import { useImages } from '../store/imageStore';
import { useHistory } from '../store/historyStore';
import { useInApp } from '../store/inAppStore';
import { loadImage, svgToUrl } from './svg';

const VERSION = 1;

// 저장에 포함할 필드 (뷰 상태 제외)
const SAVE_KEYS: (keyof EditorState)[] = [
  'name',
  'cell',
  'height',
  'capLeftWidth',
  'capRightWidth',
  'tileWidth',
  'strokeColor',
  'fillColor',
  'strokeWidth',
  'lineStyle',
  'cornerStyle',
  'cornerRadius',
  'dotLength',
  'dotGap',
  'waveAmp',
  'waveLen',
  'waveform',
  'tileMode',
  'minWidth',
  'contentInsets',
  'textColor',
  'fontSize',
  'bleed',
  'deco',
  'assets',
  'tail',
];

export interface ProjectFile {
  app: 'pixel-bubble-editor';
  version: number;
  state: Partial<EditorState>;
}

export function serializeProject(): ProjectFile {
  const s = useEditor.getState();
  const state: Record<string, unknown> = {};
  for (const k of SAVE_KEYS) state[k] = s[k];
  // assets 의 url(objectURL)은 저장하지 않음 — svg 텍스트만으로 복원
  const assets = (state.assets as EditorState['assets']).map((a) => ({ ...a, url: '' }));
  state.assets = assets;
  return { app: 'pixel-bubble-editor', version: VERSION, state: JSON.parse(JSON.stringify(state)) };
}

export function saveProject() {
  const proj = serializeProject();
  const blob = new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' });
  saveAs(blob, `${proj.state.name || 'bubble'}.pbproj.json`);
}

/** 프로젝트 적용: 상태 교체 + 에셋 이미지 재생성 + 히스토리 리셋 */
export async function applyProject(proj: ProjectFile) {
  if (proj.app !== 'pixel-bubble-editor') throw new Error('올바른 프로젝트 파일이 아닙니다.');
  const st = proj.state;
  // 에셋 url 재생성
  const assets = (st.assets ?? []).map((a) => ({ ...a, url: a.svg ? svgToUrl(a.svg) : '' }));

  // 이미지 스토어 초기화 후 재로딩
  const imgStore = useImages.getState();
  imgStore.images.clear();

  useEditor.setState({ ...st, assets, selectedId: null } as Partial<EditorState>);
  useHistory.getState().reset();
  useInApp.getState().bumpFit(); // 편집 캔버스 Fit 재적용

  await Promise.all(
    assets.map(async (a) => {
      if (!a.svg) return;
      try {
        const img = await loadImage(a.url || svgToUrl(a.svg));
        useImages.getState().setImage(a.id, img);
      } catch {
        /* skip */
      }
    })
  );
}

export async function openProjectFromFile(file: File) {
  const text = await file.text();
  const proj = JSON.parse(text) as ProjectFile;
  await applyProject(proj);
}

/** 현재 디자인을 베리에이션으로 복제 (이름에 copy 접미사, 히스토리 리셋) */
export function duplicateAsVariation() {
  const s = useEditor.getState();
  useEditor.setState({ name: `${s.name}-copy` });
  useHistory.getState().reset();
}

/** 새 빈 프로젝트 (기본값) */
export async function newProject() {
  const blank: ProjectFile = {
    app: 'pixel-bubble-editor',
    version: VERSION,
    state: {
      name: 'bubble',
      cell: 4,
      height: 28,
      capLeftWidth: 8,
      capRightWidth: 8,
      tileWidth: 16,
      strokeColor: '#e7405a',
      fillColor: '#ffd7df',
      strokeWidth: 1,
      lineStyle: 'solid',
      cornerStyle: 'pixelRound',
      cornerRadius: 4,
      dotLength: 1,
      dotGap: 1,
      waveAmp: 3,
      waveLen: 8,
      waveform: 'sine',
      tileMode: 'repeat',
      minWidth: 32,
      contentInsets: { top: 8, right: 8, bottom: 8, left: 8 },
      textColor: '#1b1b1f',
      fontSize: 12,
      bleed: 12,
      deco: { left: {}, mid: {}, right: {} },
      assets: [],
      tail: { enabled: true, assetId: '__tail__', shape: 'triangle', curl: 0.6, width: 14, height: 9, anchorX: 'center', offsetX: 0, overlap: 3 },
    },
  };
  await applyProject(blank);
}
