import { useMemo, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { useImages } from '../store/imageStore';

export default function LayerPanel() {
  const assets = useEditor((s) => s.assets);
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const updateAsset = useEditor((s) => s.updateAsset);
  const bringForward = useEditor((s) => s.bringForward);
  const sendBackward = useEditor((s) => s.sendBackward);
  const setLayerOrder = useEditor((s) => s.setLayerOrder);
  const removeAsset = useEditor((s) => s.removeAsset);
  const removeImage = useImages((s) => s.removeImage);
  const images = useImages((s) => s.images);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // 위(앞) → 아래(뒤) 순서로 표시 (zIndex 내림차순)
  const ordered = useMemo(() => [...assets].sort((a, b) => b.zIndex - a.zIndex), [assets]);

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = ordered.map((a) => a.id);
    const from = ids.indexOf(dragId);
    if (from >= 0) ids.splice(from, 1);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, dragId); // 타겟 앞(위)에 삽입
    setLayerOrder(ids);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        레이어 {assets.length > 0 ? `(${assets.length})` : ''}
      </div>
      {assets.length === 0 ? (
        <div className="px-3 py-3 text-[11px] text-gray-600">에셋을 배치하면 여기에 표시됩니다.</div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {ordered.map((a) => {
            const img = images.get(a.id);
            const sel = a.id === selectedId;
            const op = Math.round((a.opacity ?? 1) * 100);
            return (
              <div
                key={a.id}
                draggable
                onDragStart={() => setDragId(a.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overId !== a.id) setOverId(a.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  reorder(a.id);
                  setOverId(null);
                }}
                onClick={() => !a.locked && select(a.id)}
                className={`mb-1 rounded border px-1.5 py-1 ${
                  sel ? 'border-accent bg-accent/10' : 'border-line bg-panel2 hover:border-gray-600'
                } ${overId === a.id && dragId && dragId !== a.id ? 'border-t-2 border-t-accent' : ''} ${
                  a.locked ? 'opacity-80' : 'cursor-pointer'
                } ${dragId === a.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="cursor-grab select-none text-[10px] text-gray-500" title="드래그하여 순서 변경">⠿</span>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ink">
                    {img && (
                      <img
                        src={a.url}
                        alt=""
                        className="pixelated max-h-5 max-w-5 object-contain"
                        style={{ opacity: a.hidden ? 0.25 : a.opacity ?? 1 }}
                      />
                    )}
                  </div>
                  <span className={`flex-1 truncate text-[11px] ${a.hidden ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                    {a.name}
                  </span>
                  <IconBtn title={a.hidden ? '표시' : '숨김'} onClick={(e) => { e.stopPropagation(); updateAsset(a.id, { hidden: !a.hidden }, 'visibility'); }}>
                    {a.hidden ? '🚫' : '👁'}
                  </IconBtn>
                  <IconBtn title={a.locked ? '잠금 해제' : '잠금'} onClick={(e) => { e.stopPropagation(); updateAsset(a.id, { locked: !a.locked }, 'lock'); }}>
                    {a.locked ? '🔒' : '🔓'}
                  </IconBtn>
                  <IconBtn title="앞으로" onClick={(e) => { e.stopPropagation(); bringForward(a.id); }}>▲</IconBtn>
                  <IconBtn title="뒤로" onClick={(e) => { e.stopPropagation(); sendBackward(a.id); }}>▼</IconBtn>
                  <IconBtn title="삭제" onClick={(e) => { e.stopPropagation(); removeImage(a.id); removeAsset(a.id); }}>✕</IconBtn>
                </div>
                {/* 투명도 */}
                <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[9px] text-gray-500">투명도</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={op}
                    onChange={(e) => updateAsset(a.id, { opacity: Number(e.target.value) / 100 }, `opacity:${a.id}`)}
                    className="h-1 flex-1 accent-[#22c3bc]"
                  />
                  <span className="w-7 text-right text-[9px] tabular-nums text-gray-400">{op}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] text-gray-400 hover:bg-panel2 hover:text-gray-100"
    >
      {children}
    </button>
  );
}
