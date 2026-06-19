import { useEffect, useRef, useState, type ReactNode } from 'react';
import AssetPalette from './components/AssetPalette';
import CanvasEditor from './components/CanvasEditor';
import InAppPreview from './components/InAppPreview';
import PropertiesPanel from './components/PropertiesPanel';
import LayerPanel from './components/LayerPanel';
import { useEditor } from './store/editorStore';
import { useImages } from './store/imageStore';
import { useHistory } from './store/historyStore';
import { loadImage, svgToUrl } from './lib/svg';
import type { Asset } from './types';
import {
  duplicateAsVariation,
  newProject,
  openProjectFromFile,
  saveProject,
} from './lib/project';

export default function App() {
  const selectedId = useEditor((s) => s.selectedId);
  const removeAsset = useEditor((s) => s.removeAsset);
  const nudge = useEditor((s) => s.nudge);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const removeImage = useImages((s) => s.removeImage);
  const setImage = useImages((s) => s.setImage);
  const pastLen = useHistory((h) => h.past.length);
  const futureLen = useHistory((h) => h.future.length);
  const fileRef = useRef<HTMLInputElement>(null);
  const clipboard = useRef<Asset | null>(null);

  // 패널 크기(드래그로 조절). 좌측 컬럼 너비 / 우측 패널 너비 / 에셋 섹션 높이
  const mainRef = useRef<HTMLDivElement>(null);
  const [leftW, setLeftW] = useState(() =>
    Math.max(360, Math.round((window.innerWidth - 300) / 2))
  );
  const [rightW, setRightW] = useState(300);
  const [bottomH, setBottomH] = useState(200);

  const onDragLeft = (d: number) => {
    const total = mainRef.current?.clientWidth ?? window.innerWidth;
    setLeftW((w) => clamp(w + d, 280, total - rightW - 320));
  };
  const onDragRight = (d: number) => {
    const total = mainRef.current?.clientWidth ?? window.innerWidth;
    setRightW((w) => clamp(w - d, 200, total - leftW - 320));
  };
  const onDragBottom = (d: number) => {
    setBottomH((h) => clamp(h - d, 100, window.innerHeight - 220));
  };


  // 선택 에셋을 약간 오프셋해 붙여넣기(복제) + 선택
  const pasteAsset = (src: Asset) => {
    const st = useEditor.getState();
    const off = st.cell * 2;
    const url = src.svg ? svgToUrl(src.svg) : src.url;
    const id = st.addAsset({
      name: src.name,
      svg: src.svg,
      url,
      x: src.x + off,
      y: src.y + off,
      width: src.width,
      height: src.height,
      rotation: src.rotation,
      flipX: src.flipX,
    });
    if (src.svg) loadImage(url).then((img) => setImage(id, img)).catch(() => undefined);
    else {
      const ex = useImages.getState().images.get(src.id);
      if (ex) setImage(id, ex);
    }
  };

  // 전역 키보드: undo/redo, 복붙, 삭제, 방향키 미세 이동
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement)?.isContentEditable;
      // 텍스트 입력 포커스 중에는 캔버스 단축키가 가로채지 않음(일반 텍스트 편집)
      if (editable) return;

      const mod = e.metaKey || e.ctrlKey;

      // undo / redo
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // 복사 / 잘라내기 / 붙여넣기
      if (mod && e.key.toLowerCase() === 'c') {
        const a = useEditor.getState().assets.find((x) => x.id === selectedId);
        if (a) {
          clipboard.current = { ...a };
          e.preventDefault();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'x') {
        const a = useEditor.getState().assets.find((x) => x.id === selectedId);
        if (a) {
          clipboard.current = { ...a };
          removeImage(a.id);
          removeAsset(a.id);
          e.preventDefault();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        if (clipboard.current) {
          pasteAsset(clipboard.current);
          e.preventDefault();
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeImage(selectedId);
        removeAsset(selectedId);
        return;
      }

      // 방향키 미세 이동 (Shift = 큰 이동)
      if (selectedId && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? useEditor.getState().cell * 4 : useEditor.getState().cell;
        const map: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const d = map[e.key];
        if (d) nudge(selectedId, d[0], d[1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, removeAsset, removeImage, nudge, undo, redo, setImage]);

  return (
    <div className="flex h-screen flex-col bg-ink text-gray-200">
      <header className="flex items-center justify-between border-b border-line bg-panel px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">🟪 Pixel Bubble Editor</span>
          <div className="ml-2 flex items-center gap-1">
            <HeaderBtn onClick={() => newProject()} title="새 빈 프로젝트">새로</HeaderBtn>
            <HeaderBtn onClick={() => fileRef.current?.click()} title="프로젝트 열기(.pbproj.json)">열기</HeaderBtn>
            <HeaderBtn onClick={() => saveProject()} title="프로젝트 저장(.pbproj.json)">저장</HeaderBtn>
            <HeaderBtn onClick={() => duplicateAsVariation()} title="변형 복제(이름에 -copy)">복제</HeaderBtn>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                try {
                  await openProjectFromFile(f);
                } catch (err) {
                  alert('열기 실패: ' + (err as Error).message);
                }
              }
              e.target.value = '';
            }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => undo()}
            disabled={pastLen === 0}
            title="실행취소 (⌘Z)"
            className="rounded border border-line bg-panel2 px-2 py-1 text-xs text-gray-300 hover:border-accent disabled:opacity-30"
          >
            ↶ 취소
          </button>
          <button
            onClick={() => redo()}
            disabled={futureLen === 0}
            title="다시실행 (⌘⇧Z)"
            className="rounded border border-line bg-panel2 px-2 py-1 text-xs text-gray-300 hover:border-accent disabled:opacity-30"
          >
            ↷ 다시
          </button>
          <span className="ml-2 text-[11px] text-gray-600">클라이언트 단독 · 서버 없음</span>
        </div>
      </header>

      <div ref={mainRef} className="flex min-h-0 flex-1">
        {/* 좌측 컬럼 = 편집 캔버스(위, 크게) + 에셋 팔레트·레이어(아래) */}
        <section className="flex min-h-0 shrink-0 flex-col" style={{ width: leftW }}>
          <div className="flex items-center justify-between border-b border-line bg-panel px-3 py-2">
            <span className="text-xs font-semibold text-gray-300">편집 캔버스</span>
            <span className="text-[10px] text-gray-500">가이드 드래그 · 에셋 배치 · 줌/팬</span>
          </div>
          <div className="min-h-0 flex-1">
            <CanvasEditor />
          </div>
          {/* 가로 핸들: 편집 캔버스 ↔ 에셋 섹션 높이 조절 */}
          <Resizer dir="row" onDrag={onDragBottom} />
          <div className="flex shrink-0 bg-panel" style={{ height: bottomH }}>
            <div className="min-w-0 flex-1">
              <AssetPalette />
            </div>
            <div className="w-[220px] shrink-0 overflow-hidden border-l border-line">
              <LayerPanel />
            </div>
          </div>
        </section>

        {/* 세로 핸들: 좌측 컬럼 ↔ 중앙 미리보기 너비 조절 */}
        <Resizer dir="col" onDrag={onDragLeft} />

        {/* 중앙 = 인앱 미리보기(배경 업로드 및 미리보기) */}
        <section className="min-h-0 min-w-0 flex-1">
          <InAppPreview />
        </section>

        {/* 세로 핸들: 중앙 미리보기 ↔ 우측 속성 패널 너비 조절 */}
        <Resizer dir="col" onDrag={onDragRight} />

        {/* 우측 = 프레임 옵션 + 슬라이스 수치 + 내보내기 */}
        <aside className="min-h-0 shrink-0 bg-panel" style={{ width: rightW }}>
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** 드래그로 인접 패널 크기를 조절하는 핸들. dir='col'=세로 경계(좌우), 'row'=가로 경계(상하) */
function Resizer({ dir, onDrag }: { dir: 'col' | 'row'; onDrag: (deltaPx: number) => void }) {
  const last = useRef(0);
  return (
    <div
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        last.current = dir === 'col' ? e.clientX : e.clientY;
      }}
      onPointerMove={(e) => {
        if (!(e.buttons & 1)) return; // 마우스 버튼을 누른 채일 때만
        const cur = dir === 'col' ? e.clientX : e.clientY;
        const delta = cur - last.current;
        if (delta !== 0) {
          last.current = cur;
          onDrag(delta);
        }
      }}
      className={
        dir === 'col'
          ? 'w-1.5 shrink-0 cursor-col-resize touch-none select-none bg-line hover:bg-accent'
          : 'h-1.5 shrink-0 cursor-row-resize touch-none select-none bg-line hover:bg-accent'
      }
    />
  );
}

function HeaderBtn({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-gray-300 hover:border-accent"
    >
      {children}
    </button>
  );
}
