import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Image as KImage, Rect, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useEditor, snap } from '../store/editorStore';
import { useImages } from '../store/imageStore';
import { useInApp } from '../store/inAppStore';
import { useTool, type Tool } from '../store/toolStore';
import { renderBubbleDesign, renderFrameCanvas, renderTailDesign } from '../lib/render';
import { BUILTIN_TAIL_ID } from '../lib/builtinTail';
import { bleedPx, decoDims, frameToDeco, renderDecoCanvas } from '../lib/deco';
import type { DecoSeg } from '../types';

export default function CanvasEditor() {
  const s = useEditor();
  const { version } = useImages();
  const images = useImages((st) => st.images);

  const totalWidth = s.capLeftWidth + s.tileWidth + s.capRightWidth;
  const zoom = Math.max(1, Math.round(s.zoom));
  const setZoom = useCallback((z: number) => useEditor.getState().set('zoom', Math.max(1, Math.min(32, Math.round(z)))), []);

  const bleed = Math.max(0, Math.round(s.bleed));
  const tailRoomD = s.tail.enabled ? s.tail.height + 8 : 0;
  // 블리드까지 보이도록 fit 여유 포함
  const contentW = totalWidth + bleed * 2;
  const contentH = s.height + bleed * 2 + tailRoomD;

  // 컨테이너 크기 측정
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // 팬 상태(뷰 전용, 화면 px)
  const [pan, setPan] = useState({ x: 80, y: 80 });

  const fit = useCallback(() => {
    const margin = 48;
    const availW = size.w - margin * 2;
    const availH = size.h - margin * 2;
    const z = Math.max(1, Math.min(32, Math.floor(Math.min(availW / contentW, availH / contentH))));
    setZoom(z);
    // content 박스 좌상단이 (-bleed,-bleed) 이므로 그만큼 보정
    setPan({
      x: Math.round((size.w - contentW * z) / 2) + bleed * z,
      y: Math.round((size.h - contentH * z) / 2) + bleed * z,
    });
  }, [size, contentW, contentH, setZoom, bleed]);

  // 최초 1회 자동 Fit
  const didFit = useRef(false);
  useEffect(() => {
    if (!didFit.current && size.w > 100) {
      didFit.current = true;
      fit();
    }
  }, [size, fit]);

  // 새로 만들기 / 열기 / 복제 시 Fit 재적용
  const fitNonce = useInApp((st) => st.fitNonce);
  const prevNonce = useRef(fitNonce);
  useEffect(() => {
    if (fitNonce !== prevNonce.current) {
      prevNonce.current = fitNonce;
      if (size.w > 100) fit();
    }
  }, [fitNonce, size, fit]);

  // 프레임 래스터
  const frameCanvas = useMemo(
    () =>
      renderFrameCanvas({
        height: s.height,
        totalWidth,
        strokeColor: s.strokeColor,
        fillColor: s.fillColor,
        strokeWidth: s.strokeWidth,
        lineStyle: s.lineStyle,
        cornerStyle: s.cornerStyle,
        cornerRadius: s.cornerRadius,
        dotLength: s.dotLength,
        dotGap: s.dotGap,
        waveAmp: s.waveAmp,
        waveLen: s.waveLen,
        waveform: s.waveform,
      }),
    [
      s.height,
      totalWidth,
      s.strokeColor,
      s.fillColor,
      s.strokeWidth,
      s.lineStyle,
      s.cornerStyle,
      s.cornerRadius,
      s.dotLength,
      s.dotGap,
      s.waveAmp,
      s.waveLen,
      s.waveform,
    ]
  );

  const sorted = useMemo(() => [...s.assets].sort((a, b) => a.zIndex - b.zIndex), [s.assets]);

  // 생성형/빌트인 꼬리 미리보기 — 편집 캔버스에도 동일 적용
  // (업로드 에셋 꼬리는 일반 에셋 KImage 로 이미 보이므로 제외)
  const genTail =
    s.tail.enabled && (!s.tail.assetId || s.tail.assetId === BUILTIN_TAIL_ID);
  const tailCanvas = useMemo(
    () => (genTail ? renderTailDesign(s, images) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      genTail,
      s.tail.assetId,
      s.tail.shape,
      s.tail.width,
      s.tail.height,
      s.tail.overlap,
      s.strokeColor,
      s.fillColor,
      s.strokeWidth,
      version,
    ]
  );
  const tailX =
    s.tail.anchorX === 'center'
      ? Math.round(totalWidth / 2 - s.tail.width / 2)
      : s.tail.offsetX;
  const tailY = s.height - s.tail.overlap;

  // ---- 장식(데코) 모드 ----
  const tool = useTool();
  const drawMode = tool.drawMode;
  // 장식 오버레이 캔버스(맨 위, 편집 표시용)
  const decoCanvas = useMemo(
    () => renderDecoCanvas(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.deco, s.capLeftWidth, s.tileWidth, s.capRightWidth, s.height, s.bleed]
  );
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const stroke = useRef<{ active: boolean; last: { x: number; y: number } | null; lineStart: { x: number; y: number } | null }>(
    { active: false, last: null, lineStart: null }
  );
  const [linePreview, setLinePreview] = useState<{ x: number; y: number }[]>([]);

  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = s.selectedId ? nodeRefs.current.get(s.selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [s.selectedId, version, sorted, zoom, totalWidth, pan]);

  // 픽셀 크리스프: 레이어 컨텍스트 스무딩 항상 off
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const ctx = (layer.getContext() as unknown as { _context?: CanvasRenderingContext2D })._context;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    (ctx as unknown as { webkitImageSmoothingEnabled?: boolean }).webkitImageSmoothingEnabled = false;
    layer.imageSmoothingEnabled(false);
    layer.batchDraw();
  });

  // Space 팬
  const [spaceDown, setSpaceDown] = useState(false);
  const panning = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({
    active: false,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
  });
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(true);
        return;
      }
      // 장식 모드 도구 단축키
      const tl = useTool.getState();
      if (tl.drawMode && !e.metaKey && !e.ctrlKey) {
        const k = e.key.toLowerCase();
        const map: Record<string, Tool> = { b: 'pen', e: 'eraser', g: 'fill', l: 'line', i: 'eyedropper', h: 'pan' };
        if (map[k]) {
          tl.setTool(map[k]);
          return;
        }
        if (e.key === '[') {
          tl.setBrush(tl.brush - 1);
          return;
        }
        if (e.key === ']') {
          tl.setBrush(tl.brush + 1);
          return;
        }
      }
      if (e.key === '0') {
        fit();
      } else if (e.key === '+' || e.key === '=') {
        zoomAt(size.w / 2, size.h / 2, +1);
      } else if (e.key === '-' || e.key === '_') {
        zoomAt(size.w / 2, size.h / 2, -1);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, size]);

  // 커서 위치(screen px) 기준 줌
  const zoomAt = useCallback(
    (cx: number, cy: number, dir: number) => {
      const oldZ = Math.max(1, Math.round(useEditor.getState().zoom));
      const newZ = Math.max(1, Math.min(32, oldZ + dir));
      if (newZ === oldZ) return;
      setPan((p) => {
        const dpx = (cx - p.x) / oldZ;
        const dpy = (cy - p.y) / oldZ;
        return { x: Math.round(cx - dpx * newZ), y: Math.round(cy - dpy * newZ) };
      });
      setZoom(newZ);
    },
    [setZoom]
  );

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const ptr = stage?.getPointerPosition();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      if (ptr) zoomAt(ptr.x, ptr.y, e.evt.deltaY < 0 ? +1 : -1);
    } else {
      setPan((p) => ({ x: p.x - e.evt.deltaX, y: p.y - e.evt.deltaY }));
    }
  };

  // 포인터 → 프레임 픽셀 좌표
  const pointerToFrame = (): { x: number; y: number } | null => {
    const st = layerRef.current?.getStage();
    const ptr = st?.getPointerPosition();
    if (!ptr) return null;
    return {
      x: Math.floor((ptr.x - pan.x) / zoom),
      y: Math.floor((ptr.y - pan.y) / zoom),
    };
  };

  // 브러시 블록(brush×brush)을 deco 변경으로 매핑
  const brushChanges = (fx: number, fy: number, color: string | null) => {
    const half = Math.floor((tool.brush - 1) / 2);
    const out: { layer: DecoSeg; key: string; color: string | null }[] = [];
    for (let dy = 0; dy < tool.brush; dy++) {
      for (let dx = 0; dx < tool.brush; dx++) {
        const hit = frameToDeco(s, fx - half + dx, fy - half + dy);
        if (hit) out.push({ layer: hit.layer, key: `${hit.lx},${hit.ly}`, color });
      }
    }
    return out;
  };

  const paintLine = (a: { x: number; y: number }, b: { x: number; y: number }, color: string | null) => {
    // Bresenham 보간
    let x0 = a.x;
    let y0 = a.y;
    const dx = Math.abs(b.x - x0);
    const dy = Math.abs(b.y - y0);
    const sx = x0 < b.x ? 1 : -1;
    const sy = y0 < b.y ? 1 : -1;
    let err = dx - dy;
    const changes: { layer: DecoSeg; key: string; color: string | null }[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      changes.push(...brushChanges(x0, y0, color));
      if (x0 === b.x && y0 === b.y) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    if (changes.length) s.applyDeco(changes);
  };

  // flood fill (한 구간 레이어 내부)
  const floodFill = (fx: number, fy: number, color: string) => {
    const hit = frameToDeco(s, fx, fy);
    if (!hit) return;
    const dims = decoDims(s)[hit.layer];
    const map = s.deco[hit.layer];
    const target = map[`${hit.lx},${hit.ly}`] ?? '';
    if (target === color) return;
    const changes: { layer: DecoSeg; key: string; color: string | null }[] = [];
    const seen = new Set<string>();
    const stack: [number, number][] = [[hit.lx, hit.ly]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if ((map[k] ?? '') !== target) continue;
      changes.push({ layer: hit.layer, key: k, color });
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    if (changes.length) s.applyDeco(changes);
  };

  // 스포이드: 합성 말풍선(자동+장식)에서 색 추출
  const eyedrop = (fx: number, fy: number) => {
    const B = bleedPx(s);
    const cv = renderBubbleDesign(s, { images, includeTail: true, bleed: B });
    const px = fx + B;
    const py = fy + B;
    if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) return;
    const d = cv.getContext('2d')!.getImageData(px, py, 1, 1).data;
    if (d[3] < 10) return;
    const hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    tool.setColor(hex);
  };

  const beginStroke = () => {
    // 스트로크 단위 undo: 고유 라벨로 항상 push
    useEditor.getState().record(`deco:${Date.now()}`);
  };

  // 장식 모드 포인터 핸들러
  const decoDown = () => {
    const p = pointerToFrame();
    if (!p) return;
    if (tool.tool === 'eyedropper') {
      eyedrop(p.x, p.y);
      return;
    }
    beginStroke();
    if (tool.tool === 'fill') {
      floodFill(p.x, p.y, tool.color);
      return;
    }
    if (tool.tool === 'line') {
      stroke.current = { active: true, last: p, lineStart: p };
      setLinePreview([p]);
      return;
    }
    // pen / eraser
    stroke.current = { active: true, last: p, lineStart: null };
    s.applyDeco(brushChanges(p.x, p.y, tool.tool === 'eraser' ? null : tool.color));
  };
  const decoMove = () => {
    const p = pointerToFrame();
    if (p) setHover(p);
    if (!p || !stroke.current.active) return;
    if (tool.tool === 'line' && stroke.current.lineStart) {
      // 미리보기만 갱신
      const a = stroke.current.lineStart;
      const pts: { x: number; y: number }[] = [];
      let x0 = a.x;
      let y0 = a.y;
      const dx = Math.abs(p.x - x0);
      const dy = Math.abs(p.y - y0);
      const sx = x0 < p.x ? 1 : -1;
      const sy = y0 < p.y ? 1 : -1;
      let err = dx - dy;
      for (;;) {
        pts.push({ x: x0, y: y0 });
        if (x0 === p.x && y0 === p.y) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x0 += sx;
        }
        if (e2 < dx) {
          err += dx;
          y0 += sy;
        }
      }
      setLinePreview(pts);
      return;
    }
    const last = stroke.current.last ?? p;
    paintLine(last, p, tool.tool === 'eraser' ? null : tool.color);
    stroke.current.last = p;
  };
  const decoUp = () => {
    if (tool.tool === 'line' && stroke.current.lineStart) {
      const p = pointerToFrame() ?? stroke.current.last;
      if (p) paintLine(stroke.current.lineStart, p, tool.color);
      setLinePreview([]);
    }
    stroke.current = { active: false, last: null, lineStart: null };
  };

  const leftGuideX = s.capLeftWidth;
  const rightGuideX = s.capLeftWidth + s.tileWidth;

  const usingDecoPaint = drawMode && !spaceDown && tool.tool !== 'pan';
  const cursor = spaceDown
    ? panning.current.active
      ? 'grabbing'
      : 'grab'
    : usingDecoPaint
    ? 'crosshair'
    : 'default';

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[repeating-conic-gradient(#e2e5ea_0%_25%,#f5f6f8_0%_50%)] [background-size:16px_16px]"
      style={{ cursor }}
    >
      <Stage
        width={Math.max(size.w, 50)}
        height={Math.max(size.h, 50)}
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (spaceDown) {
            panning.current = { active: true, sx: e.evt.clientX, sy: e.evt.clientY, ox: pan.x, oy: pan.y };
            return;
          }
          if (usingDecoPaint) {
            decoDown();
            return;
          }
          if (e.target === e.target.getStage()) s.select(null);
        }}
        onMouseMove={(e) => {
          if (panning.current.active) {
            setPan({
              x: panning.current.ox + (e.evt.clientX - panning.current.sx),
              y: panning.current.oy + (e.evt.clientY - panning.current.sy),
            });
            return;
          }
          if (drawMode && !spaceDown) decoMove();
        }}
        onMouseUp={() => {
          panning.current.active = false;
          if (drawMode) decoUp();
        }}
        onMouseLeave={() => {
          setHover(null);
          if (stroke.current.active) decoUp();
        }}
      >
        <Layer ref={layerRef} imageSmoothingEnabled={false}>
          <Group x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
            {/* 캡 영역 음영 */}
            <Rect x={0} y={0} width={s.capLeftWidth} height={s.height} fill="#34d399" opacity={0.07} />
            <Rect x={rightGuideX} y={0} width={s.capRightWidth} height={s.height} fill="#f59e0b" opacity={0.07} />

            {/* 프레임 */}
            <KImage
              image={frameCanvas}
              x={0}
              y={0}
              width={totalWidth}
              height={s.height}
              listening={false}
              imageSmoothingEnabled={false}
            />

            {/* 생성형 꼬리 (본체 바닥에서 흘러나옴) */}
            {tailCanvas && (
              <KImage
                image={tailCanvas}
                x={tailX}
                y={tailY}
                width={s.tail.width}
                height={s.tail.height}
                listening={false}
                imageSmoothingEnabled={false}
              />
            )}

            {/* 편집 캔버스에는 텍스트를 표시하지 않음 (텍스트 색/크기 확인은 인앱 미리보기에서) */}

            {/* 에셋들 */}
            {sorted.map((a) => {
              const img = images.get(a.id);
              if (!img || a.hidden) return null;
              const locked = !!a.locked;
              return (
                <KImage
                  key={a.id}
                  ref={(node) => {
                    if (node) nodeRefs.current.set(a.id, node);
                    else nodeRefs.current.delete(a.id);
                  }}
                  image={img}
                  x={a.x + a.width / 2}
                  y={a.y + a.height / 2}
                  offsetX={a.width / 2}
                  offsetY={a.height / 2}
                  width={a.width}
                  height={a.height}
                  rotation={a.rotation}
                  scaleX={a.flipX ? -1 : 1}
                  opacity={a.opacity ?? 1}
                  imageSmoothingEnabled={false}
                  listening={!locked && !drawMode}
                  draggable={!spaceDown && !locked && !drawMode}
                  onMouseDown={() => !spaceDown && !locked && !drawMode && s.select(a.id)}
                  onTap={() => !locked && !drawMode && s.select(a.id)}
                  onDragEnd={(e) => {
                    const node = e.target;
                    const nx = snap(node.x() - a.width / 2, s.cell);
                    const ny = snap(node.y() - a.height / 2, s.cell);
                    s.updateAsset(a.id, { x: nx, y: ny });
                    node.position({ x: nx + a.width / 2, y: ny + a.height / 2 });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const sx = Math.abs(node.scaleX());
                    const sy = Math.abs(node.scaleY());
                    const newW = Math.max(s.cell, snap(a.width * sx, s.cell));
                    const newH = Math.max(s.cell, snap(a.height * sy, s.cell));
                    const rot = Math.round(node.rotation());
                    const cx = node.x();
                    const cy = node.y();
                    node.scaleX(a.flipX ? -1 : 1);
                    node.scaleY(1);
                    s.updateAsset(a.id, {
                      width: newW,
                      height: newH,
                      rotation: rot,
                      x: snap(cx - newW / 2, s.cell),
                      y: snap(cy - newH / 2, s.cell),
                    });
                  }}
                />
              );
            })}

            {/* 장식 오버레이(맨 위) — 자동 말풍선 위에 덧그린 픽셀 */}
            <KImage
              image={decoCanvas}
              x={-bleed}
              y={-bleed}
              width={totalWidth + bleed * 2}
              height={s.height + bleed * 2}
              listening={false}
              imageSmoothingEnabled={false}
            />

            {/* 직선 미리보기 */}
            {drawMode &&
              linePreview.map((p, i) => (
                <Rect key={`lp${i}`} x={p.x} y={p.y} width={1} height={1} fill={tool.color} opacity={0.7} listening={false} />
              ))}

            {/* 호버 셀 하이라이트 */}
            {drawMode && hover && (
              <Rect
                x={hover.x - Math.floor((tool.brush - 1) / 2)}
                y={hover.y - Math.floor((tool.brush - 1) / 2)}
                width={tool.brush}
                height={tool.brush}
                stroke="#22c3bc"
                strokeWidth={1 / zoom}
                listening={false}
              />
            )}

            {/* 클리핑 경계 바깥(=export 시 잘리는 영역) dim 오버레이 */}
            {(() => {
              const ix0 = -bleed;
              const iy0 = -bleed;
              const ix1 = totalWidth + bleed;
              const iy1 = s.height + bleed;
              // 현재 보이는 영역(디자인 좌표)
              const vl = -pan.x / zoom - 8;
              const vt = -pan.y / zoom - 8;
              const vr = (size.w - pan.x) / zoom + 8;
              const vb = (size.h - pan.y) / zoom + 8;
              const c = 'rgba(15,23,42,0.34)';
              const R = (x: number, y: number, w2: number, h2: number, key: string) =>
                w2 > 0 && h2 > 0 ? (
                  <Rect key={key} x={x} y={y} width={w2} height={h2} fill={c} listening={false} />
                ) : null;
              return (
                <>
                  {R(vl, vt, vr - vl, iy0 - vt, 'top')}
                  {R(vl, iy1, vr - vl, vb - iy1, 'bottom')}
                  {R(vl, iy0, ix0 - vl, iy1 - iy0, 'left')}
                  {R(ix1, iy0, vr - ix1, iy1 - iy0, 'right')}
                </>
              );
            })()}

            {/* 클리핑 경계선(민트 점선) — dim 위에 또렷하게 */}
            <Rect
              x={-bleed}
              y={-bleed}
              width={totalWidth + bleed * 2}
              height={s.height + bleed * 2}
              stroke="#22c3bc"
              strokeWidth={1 / zoom}
              dash={[3 / zoom, 3 / zoom]}
              listening={false}
            />

            <Transformer
              ref={trRef}
              rotationSnaps={[0, 90, 180, 270]}
              anchorSize={7}
              borderStroke="#22c3bc"
              anchorStroke="#22c3bc"
              anchorFill="#161922"
              flipEnabled={false}
            />

            {/* 슬라이스 구역 라벨 + 경계 가이드 (표시 토글) */}
            {tool.showGuides && (
              <>
                <RegionLabel x={0} w={s.capLeftWidth} y={-bleed} color="#34d399" text="좌캡(고정)" zoom={zoom} />
                <RegionLabel x={leftGuideX} w={s.tileWidth} y={-bleed} color="#6b7280" text="타일(반복)" zoom={zoom} />
                <RegionLabel x={rightGuideX} w={s.capRightWidth} y={-bleed} color="#f59e0b" text="우캡(고정)" zoom={zoom} />
                <SliceGuide x={leftGuideX} height={s.height} color="#34d399" locked />
                <SliceGuide x={rightGuideX} height={s.height} color="#f59e0b" locked />
              </>
            )}
          </Group>
        </Layer>
      </Stage>

      {/* 좌상단 정보 */}
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-panel/80 px-2 py-1 text-[10px] text-gray-400">
        {totalWidth}×{s.height}px {drawMode ? '· 장식 모드' : `· 셀 ${s.cell}px`} {spaceDown && '· 팬'}
      </div>

      {/* 장식 그리기 툴바 */}
      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-line bg-panel/95 px-1.5 py-1 shadow-lg">
        {!drawMode ? (
          <button
            onClick={() => tool.setDrawMode(true)}
            className="rounded bg-accent px-2 py-1 text-[11px] font-semibold text-onAccent hover:bg-accentDark"
          >
            ✏️ 장식 그리기
          </button>
        ) : (
          <>
            {([
              ['pen', 'B', '펜'],
              ['eraser', 'E', '지우개'],
              ['fill', 'G', '채우기'],
              ['line', 'L', '직선'],
              ['eyedropper', 'I', '스포이드'],
              ['pan', 'H', '이동'],
            ] as [Tool, string, string][]).map(([t, key, label]) => (
              <button
                key={t}
                onClick={() => tool.setTool(t)}
                title={`${label} (${key})`}
                className={`flex h-6 min-w-[26px] items-center justify-center rounded px-1 text-[11px] ${
                  tool.tool === t ? 'bg-accent text-onAccent' : 'text-gray-300 hover:bg-panel2'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="mx-0.5 h-4 w-px bg-line" />
            <span className="text-[10px] text-gray-500">px</span>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={tool.brush}
              onChange={(e) => tool.setBrush(Number(e.target.value))}
              className="w-14 accent-[#22c3bc]"
              title="브러시 크기 ([ ])"
            />
            <span className="w-3 text-[10px] text-gray-400">{tool.brush}</span>
            <input
              type="color"
              value={tool.color}
              onChange={(e) => tool.setColor(e.target.value)}
              className="h-6 w-7"
              title="장식 색(자유색)"
            />
            <button
              onClick={() => tool.setShowGuides(!tool.showGuides)}
              title="구간 경계 표시"
              className={`flex h-6 items-center rounded px-1.5 text-[10px] ${tool.showGuides ? 'text-accent' : 'text-gray-400 hover:bg-panel2'}`}
            >
              경계
            </button>
            <button
              onClick={() => tool.setDrawMode(false)}
              className="rounded border border-line px-2 py-1 text-[11px] text-gray-300 hover:border-accent"
            >
              종료
            </button>
          </>
        )}
      </div>

      {/* 줌 툴바 */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-line bg-panel/95 px-1.5 py-1 shadow-lg">
        <ToolBtn onClick={() => zoomAt(size.w / 2, size.h / 2, -1)} title="축소 (−)">−</ToolBtn>
        <span className="w-12 text-center text-xs tabular-nums text-gray-300">{zoom}×</span>
        <ToolBtn onClick={() => zoomAt(size.w / 2, size.h / 2, +1)} title="확대 (+)">+</ToolBtn>
        <div className="mx-1 h-4 w-px bg-line" />
        <ToolBtn onClick={fit} title="화면 맞춤 (0)">Fit</ToolBtn>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-panel/70 px-2 py-1 text-[10px] text-gray-500">
        ⌘+스크롤 줌 · Space+드래그 팬 · 0 맞춤
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-6 min-w-[28px] items-center justify-center rounded px-1.5 text-xs text-gray-300 hover:bg-panel2 hover:text-gray-100"
    >
      {children}
    </button>
  );
}

function RegionLabel({
  x,
  w,
  y,
  color,
  text,
  zoom,
}: {
  x: number;
  w: number;
  y: number;
  color: string;
  text: string;
  zoom: number;
}) {
  // 줌과 무관하게 일정 크기(작게)로, 굵게. 주어진 y 위쪽에 배치.
  const fs = Math.max(2.5, 7 / zoom);
  return (
    <Text
      x={x}
      y={y - fs - 3 / zoom}
      width={w}
      align="center"
      text={text}
      fontSize={fs}
      fontStyle="bold"
      fill={color}
      wrap="none"
      listening={false}
    />
  );
}

function SliceGuide({
  x,
  height,
  color,
  onDrag,
  locked,
}: {
  x: number;
  height: number;
  color: string;
  onDrag?: (x: number) => void;
  locked?: boolean;
}) {
  if (locked) {
    // 고정 가이드: 드래그 불가, 점선만 표시
    return (
      <Rect x={x} y={-6} width={0} height={height + 12} stroke={color} strokeWidth={1} dash={[2, 2]} opacity={0.6} listening={false} />
    );
  }
  return (
    <Rect
      x={x}
      y={-6}
      width={0}
      height={height + 12}
      stroke={color}
      strokeWidth={1}
      hitStrokeWidth={10}
      dash={[2, 2]}
      draggable
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = 'ew-resize';
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = 'default';
      }}
      dragBoundFunc={function (this: Konva.Node, pos) {
        const abs = this.getAbsolutePosition();
        return { x: pos.x, y: abs.y };
      }}
      onDragMove={(e) => onDrag?.(e.target.x())}
      onDragEnd={(e) => onDrag?.(e.target.x())}
    />
  );
}
