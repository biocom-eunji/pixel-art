import { useCallback, useRef, useState } from 'react';
import { useEditor, snap } from '../store/editorStore';
import { useImages } from '../store/imageStore';
import { loadImage, readFileAsText, svgAspect, svgToUrl } from '../lib/svg';
import { builtinAssets, type PaletteItem } from '../lib/builtinAssets';

export default function AssetPalette() {
  const [items, setItems] = useState<PaletteItem[]>(() => [...builtinAssets]);
  const builtinCount = builtinAssets.length;
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cell = useEditor((s) => s.cell);
  const addAsset = useEditor((s) => s.addAsset);
  const setImage = useImages((s) => s.setImage);

  const ingest = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.svg'));
    const next: PaletteItem[] = [];
    for (const f of arr) {
      const svg = await readFileAsText(f);
      const url = svgToUrl(svg);
      next.push({ name: f.name.replace(/\.svg$/i, ''), svg, url, aspect: svgAspect(svg) });
    }
    setItems((prev) => [...prev, ...next]);
  }, []);

  const place = useCallback(
    async (item: PaletteItem) => {
      const baseH = snap(24, cell);
      const ratio = item.aspect.w / (item.aspect.h || 1);
      const w = Math.max(cell, snap(baseH * ratio, cell));
      const h = Math.max(cell, baseH);
      const id = addAsset({
        name: item.name,
        svg: item.svg,
        url: item.url,
        x: snap(20, cell),
        y: snap(8, cell),
        width: w,
        height: h,
        rotation: 0,
        flipX: false,
      });
      const img = await loadImage(item.url);
      setImage(id, img);
    },
    [addAsset, cell, setImage]
  );

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        ingest(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xs font-semibold text-gray-200">에셋</h2>
          <span className="text-[10px] text-gray-500">
            기본 {builtinCount}{items.length > builtinCount ? ` · 업로드 ${items.length - builtinCount}` : ''} · 클릭하여 배치
          </span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-gray-300 hover:border-accent"
        >
          + SVG 업로드
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".svg,image/svg+xml"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </div>

      {/* 8열 그리드 썸네일 (줄바꿈 + 세로 스크롤) */}
      <div
        className={`grid flex-1 content-start grid-cols-8 gap-1.5 overflow-y-auto px-3 py-2 ${
          dragOver ? 'bg-accent/10' : ''
        }`}
      >
        {items.map((it, i) => (
          <button
            key={i}
            onClick={() => place(it)}
            title={`${it.name} — 클릭하여 캔버스에 배치`}
            className="group flex aspect-square flex-col items-center justify-center rounded-md border border-line bg-panel2 p-1 hover:border-accent"
          >
            <img
              src={it.url}
              alt={it.name}
              className="pixelated max-h-[80%] max-w-full object-contain"
            />
          </button>
        ))}
        {items.length === 0 && (
          <p className="col-span-8 px-1 text-[11px] text-gray-600">
            SVG를 드래그하거나 업로드하세요.
          </p>
        )}
      </div>
    </div>
  );
}
