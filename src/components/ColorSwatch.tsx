import { useEffect, useRef, useState } from 'react';
import { usePalette } from '../store/paletteStore';

interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}
const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

/** 현재 색 스와치 1개 + 클릭 시 팔레트·커스텀 피커 팝오버 */
export default function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const presets = usePalette((s) => s.presets);
  const recent = usePalette((s) => s.recent);
  const addRecent = usePalette((s) => s.addRecent);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commit = (hex: string) => {
    onChange(hex);
    addRecent(hex);
  };

  const pick = async () => {
    if (!hasEyeDropper) return;
    try {
      const ED = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const res = await new ED().open();
      commit(res.sRGBHex);
    } catch {
      /* 취소 */
    }
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${label} 색상 — 클릭하여 변경 (${value})`}
        className="h-6 w-6 rounded border border-line shadow-sm hover:ring-2 hover:ring-accent"
        style={{ backgroundColor: value }}
      />
      {open && (
        <div className="absolute left-0 top-8 z-50 w-44 rounded-lg border border-line bg-panel p-2 shadow-xl">
          {/* 큐레이션 팔레트 */}
          <div className="mb-1 text-[10px] text-gray-500">팔레트</div>
          <div className="grid grid-cols-6 gap-1">
            {presets.map((c) => (
              <button
                key={c}
                onClick={() => commit(c)}
                title={c}
                className={`h-5 w-5 rounded-sm border ${
                  c.toLowerCase() === value.toLowerCase() ? 'border-accent ring-1 ring-accent' : 'border-line'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {recent.length > 0 && (
            <>
              <div className="mb-1 mt-2 text-[10px] text-gray-500">최근</div>
              <div className="grid grid-cols-6 gap-1">
                {recent.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    onClick={() => commit(c)}
                    title={c}
                    className="h-5 w-5 rounded-sm border border-line"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </>
          )}

          {/* 커스텀 */}
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="color"
              value={value}
              onChange={(e) => commit(e.target.value)}
              className="h-6 w-8"
              title="커스텀 색"
            />
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={(e) => commit(e.target.value)}
              className="w-20 rounded border border-line bg-panel2 px-1.5 py-1 text-[11px] text-gray-200 focus:border-accent focus:outline-none"
            />
            {hasEyeDropper && (
              <button
                onClick={pick}
                title="스포이드"
                className="flex h-6 w-6 items-center justify-center rounded border border-line bg-panel2 text-[10px] hover:border-accent"
              >
                🎯
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
