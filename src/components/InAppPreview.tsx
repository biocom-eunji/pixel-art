import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { useImages } from '../store/imageStore';
import { useInApp } from '../store/inAppStore';
import { bubbleFont, composeBubbleDesign } from '../lib/compose';
import { loadImage } from '../lib/svg';
import SeamCheck from './SeamCheck';

export default function InAppPreview() {
  const s = useEditor();
  const { version } = useImages();
  const images = useImages((st) => st.images);
  const app = useInApp();
  const showBg = app.bgOn && !!app.bgImg;

  const wrapRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 600, h: 360 });
  const [seamOpen, setSeamOpen] = useState(false);
  const [fontReady, setFontReady] = useState(false);

  // Pretendard 로드 완료 후 텍스트 폭/렌더 갱신
  useEffect(() => {
    let cancelled = false;
    const done = () => !cancelled && setFontReady(true);
    if (typeof document !== 'undefined' && 'fonts' in document) {
      Promise.all([
        (document as Document).fonts.load("500 12px 'Pretendard'").catch(() => undefined),
        (document as Document).fonts.load("500 12px 'Noto Sans KR'").catch(() => undefined),
      ]).then(() => (document as Document).fonts.ready).then(done).catch(done);
    } else {
      done();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // 합성 말풍선 (텍스트 포함, 1x 디자인 해상도)
  const composed = useMemo(
    () => composeBubbleDesign(s, images, app.text),
    // fontReady: 폰트 로드 후 텍스트 폭 재측정
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, images, version, app.text, fontReady]
  );

  const PAD = 12;
  // 폰 배경을 사용 가능한 영역에 최대로 맞추는 배율(분수 허용 — 사진은 부드럽게 OK)
  const fit = useMemo(() => {
    if (!app.bgW || !app.bgH) return 1;
    return Math.min((size.w - PAD * 2) / app.bgW, (size.h - PAD * 2) / app.bgH);
  }, [app.bgW, app.bgH, size]);

  const bgDispW = Math.max(1, Math.round(app.bgW * fit));
  const bgDispH = Math.max(1, Math.round(app.bgH * fit));

  // 말풍선 표시 배율: 정수로 스냅(크리스프). 배경 on=폰배율×fit 반올림, off=슬라이더 값.
  const dispScale = useMemo(() => {
    if (showBg) return Math.max(1, Math.round(app.scale * fit));
    const maxFit = Math.floor(
      Math.min((size.w - PAD * 2) / composed.width, (size.h - PAD * 2) / composed.height)
    );
    return Math.max(1, Math.min(app.scale, Math.max(1, maxFit)));
  }, [showBg, app.scale, fit, size, composed.width, composed.height]);

  const bw = composed.width * dispScale;
  const bh = composed.height * dispScale;

  // 최초 진입 시 기본 배경(Frame.png — 캐릭터 카드) 자동 로드
  useEffect(() => {
    if (!app.bgImg) {
      loadImage('/frame-default.png')
        .then((img) => {
          app.setBg(img, '/frame-default.png');
          app.setPlaced(false);
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 배경 로드 후 기본 위치 1회: 가로 중앙 + 꼬리 끝이 캐릭터 머리 위(세로 ~37%)에 닿게.
  useEffect(() => {
    if (app.bgImg && !app.placed && composed.width > 0) {
      const targetW = app.bgW * 0.4;
      const scale = Math.max(1, Math.min(16, Math.round(targetW / composed.width)));
      const headLine = app.bgH * 0.37; // 고양이 머리(귀) 윗선
      const y = Math.max(0, Math.round(headLine - composed.height * scale));
      app.setScale(scale);
      app.setPos(0, y);
      app.setPlaced(true);
    }
  }, [app.bgImg, app.placed, composed, app, fit]);

  const fileRef = useRef<HTMLInputElement>(null);
  const onUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    app.setBg(img, url);
    app.setPlaced(false);
  };

  // 말풍선 캔버스(편집 캔버스와 동일한 크리스프 원칙):
  //  - 백킹 스토어를 "표시 크기 × DPR"(디바이스 해상도)로 잡고
  //  - 스프라이트(프레임/에셋/꼬리)는 정수 nearest 로 확대(imageSmoothing=false)
  //  - 텍스트는 굽지 않고 최종 표시 배율에서 직접 그려 또렷하게(anti-alias)
  //  배경의 분수배 스케일에 휩쓸리지 않는 독립 레이어.
  useEffect(() => {
    const cv = bubbleRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const backW = Math.max(1, Math.round(bw * dpr));
    const backH = Math.max(1, Math.round(bh * dpr));
    cv.width = backW;
    cv.height = backH;
    cv.style.width = `${bw}px`;
    cv.style.height = `${bh}px`;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, backW, backH);

    // 스프라이트: 디자인 → 디바이스 해상도 nearest
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(composed.canvas, 0, 0, composed.width, composed.height, 0, 0, backW, backH);

    // 텍스트: 표시 해상도에서 또렷하게
    if (composed.text) {
      const sx = backW / composed.width;
      const sy = backH / composed.height;
      ctx.imageSmoothingEnabled = true;
      ctx.font = bubbleFont(composed.fontPx * sy);
      ctx.fillStyle = composed.textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(composed.text, composed.textCx * sx, composed.textCy * sy);
    }
  }, [composed, version, showBg, bw, bh]);

  // 화면상 말풍선 위치 (블리드만큼 보정해 프레임이 정위치에 오게)
  const Bpx = composed.bleed * dispScale; // 표시 px 기준 블리드
  const bubbleLeft = showBg ? Math.round(bgDispW / 2 - bw / 2) : Math.round((size.w - bw) / 2);
  const bubbleTop = showBg
    ? Math.round(app.y * fit - Bpx)
    : Math.round((size.h - bh) / 2);

  // 세로 드래그(배경 on)
  const drag = useRef<{ sy: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!showBg) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sy: e.clientY, oy: app.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    app.setPos(0, Math.round(drag.current.oy + (e.clientY - drag.current.sy) / fit));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="flex h-full flex-col bg-ink">
      {/* 컨트롤 바 (텍스트 입력은 우측 "텍스트" 섹션으로 이동) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-1.5">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-gray-300 hover:border-accent"
        >
          배경 업로드
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
        <label className="flex items-center gap-1 text-[11px] text-gray-400">
          <input
            type="checkbox"
            checked={app.bgOn}
            onChange={(e) => app.setBgOn(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#22c3bc]"
          />
          배경
        </label>
        <label className="flex items-center gap-1 text-[11px] text-gray-400">
          배율
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={app.scale}
            onChange={(e) => app.setScale(Number(e.target.value))}
            className="w-24 accent-[#22c3bc]"
          />
          <span className="w-6 tabular-nums text-gray-300">{app.scale}×</span>
        </label>
        <span className="rounded bg-panel2 px-2 py-1 text-[10px] tabular-nums text-gray-500">
          {showBg ? `가운데 · y:${app.y}` : 'RN 합성(배경 off)'} · {composed.width}×{composed.height} · 표시 {dispScale}x
        </span>
      </div>

      {/* 메인 스테이지: 폰/말풍선을 가운데 정렬, 빈 영역 최소화 */}
      <div ref={wrapRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        {showBg ? (
          <div className="relative shadow-lg" style={{ width: bgDispW, height: bgDispH }}>
            <img
              src={app.bgUrl ?? undefined}
              alt=""
              draggable={false}
              style={{ width: bgDispW, height: bgDispH, display: 'block' }}
            />
            <canvas
              ref={bubbleRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="pixelated absolute"
              style={{ left: bubbleLeft, top: bubbleTop, width: bw, height: bh, cursor: 'ns-resize' }}
            />
          </div>
        ) : (
          // 배경 off = RN 합성 미리보기: 말풍선 영역까지만 체커
          <div
            className="rounded border border-line bg-[repeating-conic-gradient(#e2e5ea_0%_25%,#f5f6f8_0%_50%)] [background-size:16px_16px]"
            style={{ padding: PAD }}
          >
            <canvas
              ref={bubbleRef}
              className="pixelated block"
              style={{ width: bw, height: bh }}
            />
          </div>
        )}

        {!app.bgImg && app.bgOn && (
          <div className="pointer-events-none absolute text-center text-[11px] text-gray-500">
            폰 스크린샷(PNG)을 "배경 업로드"로 올리면
            <br />그 위에 현재 말풍선이 실시간으로 얹힙니다.
          </div>
        )}
      </div>

      {/* 접이식: 타일 이음매 검사 */}
      <div className="border-t border-line bg-panel">
        <button
          onClick={() => setSeamOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-400 hover:text-gray-200"
        >
          <span>{seamOpen ? '▼' : '▶'}</span>
          타일 이음매 검사 (mid×N)
        </button>
        {seamOpen && (
          <div className="max-h-44 overflow-y-auto">
            <SeamCheck />
          </div>
        )}
      </div>
    </div>
  );
}
