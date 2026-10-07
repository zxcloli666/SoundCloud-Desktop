//! Река через всю страницу: путь строится по якорям секций. Координаты —
//! offsetTop/offsetLeft относительно обёртки (скролл и вьюпорт НЕ участвуют),
//! пересборка — ResizeObserver на обёртке: догрузки/ресайзы перерисовывают
//! путь сами. Четыре слоя обводки как в макете: широкое свечение → среднее →
//! ядро → бегущий пунктир течения.

import React, {useEffect, useRef, useState} from 'react';
import {useAppIdle, usePerfMode} from '../../../lib/perf';

export type AnchorKind = 'node' | 'branch' | 'delta';

export interface RiverAnchor {
  el: HTMLElement;
  kind: AnchorKind;
  order: number;
}

export type AnchorMap = Map<string, RiverAnchor>;

interface Pt {
  x: number;
  y: number;
}

function offsetWithin(el: HTMLElement, root: HTMLElement): Pt {
  let x = 0;
  let y = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    x += cur.offsetLeft;
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

interface Geometry {
  w: number;
  h: number;
  d: string;
  branches: string[];
  nodes: Pt[];
}

function buildGeometry(root: HTMLElement, anchors: AnchorMap): Geometry | null {
  const w = root.clientWidth;
  const h = root.clientHeight;
  if (w === 0 || h === 0) return null;

  const sorted = [...anchors.values()].sort((a, b) => a.order - b.order);
  const channel = sorted.filter((a) => a.kind !== 'branch');
  if (channel.length === 0) return null;

  // Река втекает сверху, из-под деки, и сходится в дельту по центру.
  const pts: Pt[] = [{ x: w * 0.56, y: -36 }];
  for (const a of channel) {
    const o = offsetWithin(a.el, root);
    pts.push(
      a.kind === 'delta'
        ? { x: o.x + a.el.offsetWidth / 2, y: o.y + 18 }
        : { x: o.x + 26, y: o.y + 12 },
    );
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dy = b.y - a.y;
    const bulge = (i % 2 ? 1 : -1) * Math.min(170, Math.abs(dy) * 0.55);
    d += ` C ${a.x + bulge} ${a.y + dy * 0.45}, ${b.x + bulge * 0.5} ${b.y - dy * 0.45}, ${b.x} ${b.y}`;
  }

  // Ветки: от ближайшей по высоте точки русла к правым притокам.
  const branches: string[] = [];
  for (const a of sorted) {
    if (a.kind !== 'branch') continue;
    const o = offsetWithin(a.el, root);
    const tx = o.x + 14;
    const ty = o.y + 46;
    let sx = pts[0].x;
    for (const p of pts) {
      if (p.y <= ty) sx = p.x;
    }
    const sy = ty - 170;
    branches.push(`M ${sx} ${sy} C ${sx + 60} ${sy + 90}, ${tx - 160} ${ty}, ${tx} ${ty}`);
  }

  return { w, h, d, branches, nodes: pts.slice(1) };
}

/** SVG-слой реки под контентом. `layoutKey` — отпечаток состава секций
 *  (смена набора кластеров перестраивает путь немедленно, не дожидаясь RO). */
export const RiverBraid = React.memo(function RiverBraid({
  rootRef,
  anchorsRef,
  tint,
  layoutKey,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  anchorsRef: React.RefObject<AnchorMap>;
  tint?: string[];
  layoutKey: string;
}) {
  const perf = usePerfMode();
  const [geo, setGeo] = useState<Geometry | null>(null);
  const rafRef = useRef(0);
  // SMIL не паузится глобальным CSS-гейтом [data-app-hidden] — гасим руками.
  const idle = useAppIdle();

  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutKey намеренно триггерит пересборку пути.
  useEffect(() => {
    const root = rootRef.current;
    const anchors = anchorsRef.current;
    if (!root || !anchors) return;

    const recompute = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setGeo(buildGeometry(root, anchors)));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(root);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [layoutKey, rootRef, anchorsRef]);

  if (!geo) return null;

  const c0 = tint?.[0] ?? 'var(--color-accent)';
  const c1 = tint?.[1] ?? c0;
  const c2 = tint?.[2] ?? c1;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 hidden overflow-visible lg:block"
      width="100%"
      height="100%"
      viewBox={`0 0 ${geo.w} ${geo.h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="riv-fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c0} stopOpacity="0.8" />
          <stop offset="0.5" stopColor={c1} stopOpacity="0.55" />
          <stop offset="1" stopColor={c2} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {perf.bloom && (
        <path
          d={geo.d}
          fill="none"
          stroke="url(#riv-fg)"
          strokeWidth={72}
          opacity={0.085}
          strokeLinecap="round"
        />
      )}
      {perf.bloom && (
        <path
          d={geo.d}
          fill="none"
          stroke="url(#riv-fg)"
          strokeWidth={14}
          opacity={0.1}
          strokeLinecap="round"
        />
      )}
      <path d={geo.d} fill="none" stroke="url(#riv-fg)" strokeWidth={1.7} opacity={0.75} />
      {perf.idleAnim && !idle && (
        <>
          <path
            d={geo.d}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2.2}
            opacity={0.5}
            strokeDasharray="3 15"
            strokeLinecap="round"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-680"
              dur="18s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d={geo.d}
            fill="none"
            stroke="var(--color-accent-hover)"
            strokeWidth={1.3}
            opacity={0.75}
            strokeDasharray="2 30"
            strokeLinecap="round"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-640"
              dur="9s"
              repeatCount="indefinite"
            />
          </path>
        </>
      )}
      {geo.branches.map((b) => (
        <path key={b} d={b} fill="none" stroke="url(#riv-fg)" strokeWidth={1.2} opacity={0.35} />
      ))}
      {geo.nodes.map((p) => (
        <g key={`${p.x}:${p.y}`}>
          <circle cx={p.x} cy={p.y} r={9} fill="var(--color-accent)" opacity={0.1} />
          <circle cx={p.x} cy={p.y} r={2.8} fill="var(--color-accent)" opacity={0.6} />
        </g>
      ))}
    </svg>
  );
});
