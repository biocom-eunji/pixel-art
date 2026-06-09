import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { useImages } from '../store/imageStore';
import { cropCanvas, renderBubbleDesign, scaleCanvas } from '../lib/render';

/** 좌캡 + (가운데 타일 × N) + 우캡 을 합성해 이음매를 육안 검증 */
export default function SeamCheck() {
  const s = useEditor();
  const { version } = useImages();
  const images = useImages((st) => st.images);
  const [reps, setReps] = useState(4);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const PV = 3;
    const design = renderBubbleDesign(s, { images, includeTail: false });
    const full = scaleCanvas(design, PV);
    const left = cropCanvas(full, 0, 0, s.capLeftWidth * PV, s.height * PV);
    const mid = cropCanvas(full, s.capLeftWidth * PV, 0, s.tileWidth * PV, s.height * PV);
    const right = cropCanvas(full, (s.capLeftWidth + s.tileWidth) * PV, 0, s.capRightWidth * PV, s.height * PV);

    const W = left.width + mid.width * reps + right.width;
    const H = s.height * PV;
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    let x = 0;
    ctx.drawImage(left, x, 0);
    x += left.width;
    for (let i = 0; i < reps; i++) {
      ctx.drawImage(mid, x, 0);
      x += mid.width;
    }
    ctx.drawImage(right, x, 0);
  }, [s, images, version, reps]);

  return (
    <div className="p-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] text-gray-500">mid 반복</span>
        <input
          type="range"
          min={2}
          max={8}
          step={1}
          value={reps}
          onChange={(e) => setReps(Number(e.target.value))}
          className="w-24 accent-[#22c3bc]"
        />
        <span className="text-[10px] tabular-nums text-gray-400">×{reps}</span>
        <span className="ml-auto text-[10px] text-gray-500">이음매가 보이면 타일 폭 조정</span>
      </div>
      <div className="overflow-auto rounded border border-line bg-[repeating-conic-gradient(#e2e5ea_0%_25%,#f5f6f8_0%_50%)] [background-size:12px_12px] p-2">
        <canvas ref={ref} className="pixelated block" />
      </div>
    </div>
  );
}
