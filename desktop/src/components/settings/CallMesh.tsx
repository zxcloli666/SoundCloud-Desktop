import { memo } from 'react';

const KEYFRAMES = `
@keyframes cps-flow { to { stroke-dashoffset: -18; } }
@keyframes cps-node { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
@keyframes cps-halo { 0%,100% { opacity: .14; } 50% { opacity: .34; } }
`;

const CORE: [number, number] = [180, 52];

const PEERS: Array<[number, number]> = [
  [28, 26],
  [86, 92],
  [150, 20],
  [214, 96],
  [268, 30],
  [330, 84],
  [300, 108],
  [60, 104],
  [120, 60],
  [240, 58],
  [345, 40],
];

const LINKS: Array<[number, number, number, number]> = [
  [28, 26, 60, 104],
  [268, 30, 330, 84],
  [214, 96, 300, 108],
  [150, 20, 268, 30],
  [120, 60, 240, 58],
];

export const CallMesh = memo(function CallMesh({
  lit,
  animate,
  glow,
}: {
  lit: boolean;
  animate: boolean;
  glow: boolean;
}) {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 360 120"
      preserveAspectRatio="xMidYMid slice"
    >
      <style>{KEYFRAMES}</style>
      {PEERS.map(([x, y], i) => (
        <line
          key={`s${x}-${y}`}
          x1={CORE[0]}
          y1={CORE[1]}
          x2={x}
          y2={y}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeDasharray="3 7"
          style={
            animate
              ? { animation: `cps-flow ${(0.7 + (i % 3) * 0.25).toFixed(2)}s linear infinite` }
              : undefined
          }
        />
      ))}
      {LINKS.map(([x1, y1, x2, y2], i) => (
        <line
          key={`l${x1}-${y1}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeDasharray="2 8"
          style={
            animate
              ? { animation: `cps-flow ${(1 + i * 0.2).toFixed(2)}s linear infinite` }
              : undefined
          }
        />
      ))}
      {PEERS.map(([x, y], i) => (
        <circle
          key={`n${x}-${y}`}
          cx={x}
          cy={y}
          r={2.6}
          fill="currentColor"
          style={{
            opacity: lit ? 0.9 : 0.5,
            filter: glow && lit ? 'drop-shadow(0 0 4px currentColor)' : undefined,
            animation: animate
              ? `cps-node ${(2.4 + (i % 4) * 0.5).toFixed(2)}s ease-in-out ${(i * 0.3).toFixed(2)}s infinite`
              : undefined,
          }}
        />
      ))}
      <circle
        cx={CORE[0]}
        cy={CORE[1]}
        r={18}
        fill="currentColor"
        style={{
          opacity: 0.18,
          animation: animate ? 'cps-halo 2.6s ease-in-out infinite' : undefined,
        }}
      />
      <circle cx={CORE[0]} cy={CORE[1]} r={6} fill="currentColor" />
      <circle cx={CORE[0]} cy={CORE[1]} r={2.4} fill="rgb(var(--paper))" />
    </svg>
  );
});
