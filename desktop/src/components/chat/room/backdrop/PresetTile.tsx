import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackdropPreset } from '../presets/types';
import { Tile, TileLabel } from './Tile';

export const PresetTile = memo(function PresetTile({
  preset,
  current,
  pending,
  disabled,
  live,
  onPick,
  onFocus,
}: {
  preset: BackdropPreset;
  current: boolean;
  pending: boolean;
  disabled: boolean;
  live: boolean;
  onPick: () => void;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const label = t(`chat.backdrop.presets.${preset.id}`);
  return (
    <Tile
      label={label}
      current={current}
      pending={pending}
      disabled={disabled}
      onPick={onPick}
      onFocus={onFocus}
    >
      <img
        src={preset.tile}
        alt=""
        draggable={false}
        decoding="async"
        className="backdrop-motion absolute inset-0 h-full w-full object-cover"
        style={{
          animation: live ? 'backdrop-drift 22s ease-in-out infinite' : undefined,
          transform: live ? undefined : 'scale(1.04)',
        }}
      />
      {live && (
        <span
          aria-hidden
          className="backdrop-motion absolute inset-y-0 -left-1/2 w-full"
          style={{
            background: `linear-gradient(100deg, transparent 30%, rgb(255 255 255 / ${preset.tone === 'dark' ? 0.09 : 0.24}) 50%, transparent 70%)`,
            animation: 'backdrop-sheen 9s ease-in-out infinite',
          }}
        />
      )}
      <TileLabel tone={preset.tone}>{label}</TileLabel>
    </Tile>
  );
});
