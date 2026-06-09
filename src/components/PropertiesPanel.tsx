import React, { useRef, useState } from 'react';
import { useEditor } from '../store/editorStore';
import { useImages } from '../store/imageStore';
import { useInApp } from '../store/inAppStore';
import type { CornerStyle, LineStyle, Waveform } from '../types';
import { exportZip, validate } from '../lib/exporter';
import { BUILTIN_TAIL_ID, BUILTIN_TAIL_SIZE } from '../lib/builtinTail';
import ColorSwatch from './ColorSwatch';

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line px-4 py-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-300"
      >
        <span className="text-[9px]">{open ? '▼' : '▶'}</span>
        {title}
      </button>
      {open && <div className="mt-2 space-y-2.5">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function Num({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  w = 'w-16',
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  w?: string;
  unit?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const drag = useRef<{ startX: number; startVal: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startVal: value };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    // 4px 당 1 step (Shift 누르면 더 크게)
    const mult = e.shiftKey ? 4 : 1;
    const delta = Math.round(dx / 4) * step * mult;
    onChange(clamp(drag.current.startVal + delta));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className={`flex items-center ${w}`}>
      {/* 라벨/단위는 좌우 드래그-스크럽 핸들 */}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = clamp(Number(e.target.value));
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="w-full rounded-l border border-line bg-panel2 px-2 py-1 text-right text-xs text-gray-200 focus:border-accent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="좌우로 드래그하여 값 조절"
        className="flex w-5 cursor-ew-resize select-none items-center justify-center rounded-r border border-l-0 border-line bg-panel2 text-[9px] text-gray-500 hover:bg-panel hover:text-gray-300"
      >
        {unit ?? '↔'}
      </span>
    </div>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded border border-line">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2 py-1 text-[11px] ${
            value === o.v ? 'bg-accent font-semibold text-onAccent' : 'bg-panel2 text-gray-400 hover:text-gray-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function PropertiesPanel() {
  const s = useEditor();
  const images = useImages((st) => st.images);
  const text = useInApp((st) => st.text);
  const setText = useInApp((st) => st.setText);
  const [busy, setBusy] = useState(false);

  const warnings = validate(s);
  const selected = s.assets.find((a) => a.id === s.selectedId);

  const doExport = async () => {
    setBusy(true);
    try {
      await exportZip(s, images);
    } catch (e) {
      console.error(e);
      alert('내보내기 실패: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <input
          value={s.name}
          onChange={(e) => s.set('name', e.target.value)}
          className="w-full rounded border border-line bg-panel2 px-2 py-1 text-sm font-semibold text-gray-100 focus:border-accent focus:outline-none"
          placeholder="말풍선 이름"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {/* 텍스트 (최상단 고정) */}
      <Section title="텍스트">
        <div className="space-y-1">
          <span className="text-xs text-gray-400">텍스트 내용</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="말풍선 문구"
            className="w-full rounded border border-line bg-panel2 px-2 py-1.5 text-sm text-gray-100 focus:border-accent focus:outline-none"
          />
        </div>
        <p className="text-[10px] text-gray-500">
          폰트 12px · Pretendard Medium(500) 고정 · 높이는 텍스트에 맞춰 자동(hug)
        </p>
      </Section>

      <Section title="색상">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ColorSwatch label="선" value={s.strokeColor} onChange={(c) => s.set('strokeColor', c)} />
          <ColorSwatch label="면" value={s.fillColor} onChange={(c) => s.set('fillColor', c)} />
          <ColorSwatch label="텍스트" value={s.textColor} onChange={(c) => s.set('textColor', c)} />
        </div>
      </Section>

      <Section title="선 / 모서리">
        <Row label="선 두께">
          <Num value={s.strokeWidth} min={1} max={4} onChange={(v) => s.set('strokeWidth', v)} w="w-12" />
        </Row>
        <Row label="선 스타일">
          <Seg<LineStyle>
            value={s.lineStyle}
            onChange={(v) => s.set('lineStyle', v)}
            options={[
              { v: 'solid', label: '실선' },
              { v: 'dotted', label: '점선' },
              { v: 'wave', label: '물결' },
            ]}
          />
        </Row>
        {s.lineStyle === 'dotted' && (
          <>
            <Row label="점 길이">
              <Num value={s.dotLength} min={1} max={32} onChange={(v) => s.set('dotLength', v)} unit="px" />
            </Row>
            <Row label="간격">
              <Num value={s.dotGap} min={1} max={32} onChange={(v) => s.set('dotGap', v)} unit="px" />
            </Row>
            {s.tileWidth % (s.dotLength + s.dotGap) !== 0 && (
              <p className="text-[10px] text-amber-600">
                ⚠ 점선 주기({s.dotLength + s.dotGap})가 타일 폭({s.tileWidth})의 약수가 아니라 반복 시 이음매가 보입니다.
              </p>
            )}
          </>
        )}
        {s.lineStyle === 'wave' && (
          <>
            <Row label="진폭(amplitude)">
              <Num value={s.waveAmp} min={0} max={Math.floor(s.height / 2)} onChange={(v) => s.set('waveAmp', v)} w="w-14" />
            </Row>
            <Row label="파장(wavelength)">
              <Num value={s.waveLen} min={2} max={128} onChange={(v) => s.set('waveLen', v)} w="w-14" />
            </Row>
            <Row label="파형">
              <Seg<Waveform>
                value={s.waveform}
                onChange={(v) => s.set('waveform', v)}
                options={[
                  { v: 'sine', label: '사인' },
                  { v: 'zigzag', label: '지그재그' },
                ]}
              />
            </Row>
            {s.tileWidth % s.waveLen !== 0 && (
              <p className="text-[10px] text-amber-600">
                ⚠ 파장({s.waveLen})이 타일 폭({s.tileWidth})의 약수가 아니라 반복 시 이음매가 보입니다. (8/4/2 권장)
              </p>
            )}
          </>
        )}
        <Row label="모서리">
          <Seg<CornerStyle>
            value={s.cornerStyle}
            onChange={(v) => s.set('cornerStyle', v)}
            options={[
              { v: 'square', label: '각짐' },
              { v: 'pixelRound', label: '계단' },
              { v: 'round', label: '원형' },
            ]}
          />
        </Row>
        {s.cornerStyle === 'pixelRound' && (
          <Row label="계단 크기">
            <Num value={s.cornerRadius} min={1} max={16} onChange={(v) => s.set('cornerRadius', v)} w="w-12" />
          </Row>
        )}
        {s.cornerStyle === 'round' && (
          <Row label="반지름(radius)">
            <Num value={s.cornerRadius} min={1} max={Math.floor(s.height / 2)} onChange={(v) => s.set('cornerRadius', v)} w="w-12" />
          </Row>
        )}
      </Section>

      <Section title="꼬리">
        <Row label="사용">
          <input
            type="checkbox"
            checked={s.tail.enabled}
            onChange={(e) =>
              e.target.checked
                ? s.setTail({
                    enabled: true,
                    assetId: BUILTIN_TAIL_ID,
                    width: BUILTIN_TAIL_SIZE.w,
                    height: BUILTIN_TAIL_SIZE.h,
                    anchorX: 'center',
                    offsetX: 0,
                    overlap: 3,
                  })
                : s.setTail({ enabled: false })
            }
            className="h-4 w-4 accent-[#22c3bc]"
          />
        </Row>
        {s.tail.enabled && (
          <p className="text-[10px] text-gray-500">내가 그린 꼬리 · 겹침 3 (고정)</p>
        )}
      </Section>

      {selected && (
        <Section title={`선택: ${selected.name}`}>
          <Row label="X / Y">
            <Num value={selected.x} onChange={(v) => s.updateAsset(selected.id, { x: v })} w="w-14" />
            <Num value={selected.y} onChange={(v) => s.updateAsset(selected.id, { y: v })} w="w-14" />
          </Row>
          <Row label="W / H">
            <Num value={selected.width} min={1} onChange={(v) => s.updateAsset(selected.id, { width: v })} w="w-14" />
            <Num value={selected.height} min={1} onChange={(v) => s.updateAsset(selected.id, { height: v })} w="w-14" />
          </Row>
          <Row label="회전">
            <Num value={selected.rotation} min={-360} max={360} onChange={(v) => s.updateAsset(selected.id, { rotation: v })} w="w-14" />
          </Row>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button onClick={() => s.flipSelected()} className="rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-gray-300 hover:border-accent">
              좌우반전
            </button>
            <button onClick={() => s.bringForward(selected.id)} className="rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-gray-300 hover:border-accent">
              앞으로
            </button>
            <button onClick={() => s.sendBackward(selected.id)} className="rounded border border-line bg-panel2 px-2 py-1 text-[11px] text-gray-300 hover:border-accent">
              뒤로
            </button>
            <button onClick={() => s.removeAsset(selected.id)} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-600 hover:border-red-500">
              삭제
            </button>
          </div>
        </Section>
      )}
      </div>

      {/* 고정 푸터: 항상 보이는 내보내기 */}
      <div className="border-t border-line bg-panel px-4 py-3">
        {warnings.length > 0 && (
          <ul className="mb-2 max-h-24 space-y-1 overflow-y-auto">
            {warnings.map((w, i) => (
              <li key={i} className="rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-700">
                ⚠ {w.message}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={doExport}
          disabled={busy}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-bold text-onAccent hover:bg-accentDark disabled:opacity-50"
        >
          {busy ? '내보내는 중…' : 'ZIP 내보내기 (@1x·2x·3x + manifest + RN)'}
        </button>
      </div>
    </div>
  );
}
