import type { CSSProperties } from 'react';

const TILES = [
  { from: '-58px', tilt: '-9deg', paint: 'linear-gradient(150deg, #ff9a62, #ff5d8f)' },
  { from: '-20px', tilt: '6deg', paint: 'linear-gradient(150deg, #7c8cff, #45c8ff)' },
  { from: '20px', tilt: '-5deg', paint: 'linear-gradient(150deg, #ffd36b, #ff8a3d)' },
  { from: '58px', tilt: '10deg', paint: 'linear-gradient(150deg, #57e0b0, #2f8cff)' },
];

const CYCLE_S = 4.6;

export function PreviewAlbum({ caption }: { caption: string }) {
  return (
    <div className="relative flex h-[132px] items-end justify-end overflow-hidden rounded-[16px] bg-ink/[0.035] px-3 pb-3">
      <div className="relative w-[148px] p-1.5">
        <span
          data-preview-anim
          aria-hidden
          className="absolute inset-0 rounded-[16px] rounded-br-[6px]"
          style={{
            background: 'var(--color-accent)',
            animation: `chat-preview-bubble ${CYCLE_S}s var(--ease-apple, ease-out) infinite both`,
          }}
        />
        <div className="relative grid grid-cols-2 gap-1">
          {TILES.map((tile, index) => (
            <span
              key={tile.paint}
              data-preview-anim
              className="block h-[42px] rounded-[10px]"
              style={
                {
                  background: tile.paint,
                  '--from-x': tile.from,
                  '--tilt': tile.tilt,
                  animation: `chat-preview-fly ${CYCLE_S}s cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 0.12}s infinite both`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <span
          data-preview-anim
          className="relative block px-1 pt-1 text-[11px] font-medium text-accent-contrast"
          style={{
            animation: `chat-preview-bubble ${CYCLE_S}s var(--ease-apple, ease-out) infinite both`,
          }}
        >
          {caption}
        </span>
      </div>
    </div>
  );
}
