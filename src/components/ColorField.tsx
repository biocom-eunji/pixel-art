import { usePalette } from '../store/paletteStore';

// EyeDropper API 타입 (브라우저 지원 시)
interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}
const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

export default function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const presets = usePalette((s) => s.presets);
  const recent = usePalette((s) => s.recent);
  const addRecent = usePalette((s) => s.addRecent);

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

  const swatches = Array.from(new Set([...recent, ...presets])).slice(0, 14);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => commit(e.target.value)}
        className="h-6 w-9"
      />
      <div className="flex flex-wrap gap-0.5">
        {swatches.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => commit(c)}
            className={`h-4 w-4 rounded-sm border ${
              c.toLowerCase() === value.toLowerCase() ? 'border-white' : 'border-line'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      {hasEyeDropper && (
        <button
          onClick={pick}
          title="스포이드"
          className="flex h-5 w-5 items-center justify-center rounded border border-line bg-panel2 text-[10px] hover:border-accent"
        >
          🎯
        </button>
      )}
    </div>
  );
}
