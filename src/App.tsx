import { useEffect, useRef, type ReactNode } from 'react';
import AssetPalette from './components/AssetPalette';
import CanvasEditor from './components/CanvasEditor';
import InAppPreview from './components/InAppPreview';
import PropertiesPanel from './components/PropertiesPanel';
import LayerPanel from './components/LayerPanel';
import { useEditor } from './store/editorStore';
import { useImages } from './store/imageStore';
import { useHistory } from './store/historyStore';
import { loadImage, svgToUrl } from './lib/svg';
import { BUILTIN_TAIL_ID, loadBuiltinTail } from './lib/builtinTail';
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

  // 직접 그린 빌트인 꼬리 이미지를 imageStore 에 로드(예약 id)
  useEffect(() => {
    loadBuiltinTail()
      .then((img) => useImages.getState().setImage(BUILTIN_TAIL_ID, img))
      .catch(() => undefined);
  }, []);

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

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr_300px]">
        {/* 좌측 컬럼 = 편집 캔버스(위, 크게) + 에셋 팔레트·레이어(아래) */}
        <section className="flex min-h-0 flex-col border-r border-line">
          <div className="flex items-center justify-between border-b border-line bg-panel px-3 py-2">
            <span className="text-xs font-semibold text-gray-300">편집 캔버스</span>
            <span className="text-[10px] text-gray-500">가이드 드래그 · 에셋 배치 · 줌/팬</span>
          </div>
          <div className="min-h-0 flex-1">
            <CanvasEditor />
          </div>
          <div className="flex h-[200px] shrink-0 border-t border-line bg-panel">
            <div className="min-w-0 flex-1">
              <AssetPalette />
            </div>
            <div className="w-[220px] shrink-0 overflow-hidden border-l border-line">
              <LayerPanel />
            </div>
          </div>
        </section>

        {/* 중앙 = 인앱 미리보기 */}
        <section className="min-h-0 border-r border-line">
          <InAppPreview />
        </section>

        {/* 우측 = 프레임 옵션 + 슬라이스 수치 + 내보내기 */}
        <aside className="min-h-0 bg-panel">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
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
