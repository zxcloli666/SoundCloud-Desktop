import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Images } from '../../../lib/icons';
import { clock } from './countdown';
import type { PhotoState } from './PhotoTile';
import { Tile } from './Tile';

export const STORED_TILE = '[data-ui="chat-backdrop-stored"]';

export const StoredTile = memo(function StoredTile({
  state,
  disabled,
  starred = false,
  onPick,
  onFocus,
}: {
  state: PhotoState;
  disabled: boolean;
  starred?: boolean;
  onPick: () => void;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const cooling = state.kind === 'cooldown';
  const label = cooling
    ? t('chat.backdrop.storedIn', { time: clock(state.leftMs) })
    : t('chat.backdrop.stored');
  return (
    <Tile
      label={label}
      ui="chat-backdrop-stored"
      current={false}
      pending={false}
      disabled={disabled}
      starred={starred}
      onPick={onPick}
      onFocus={onFocus}
    >
      <span className="absolute inset-0 rounded-xl border border-dashed border-ink/20 bg-ink/[0.03]" />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1.5 text-center">
        <Images size={16} className={cooling ? 'text-ink-40' : 'text-ink-60'} />
        <span
          className={`line-clamp-2 text-[11px] font-semibold leading-tight ${cooling ? 'tabular-nums text-ink-60' : 'text-ink-80'}`}
        >
          {cooling ? clock(state.leftMs) : t('chat.backdrop.stored')}
        </span>
      </span>
    </Tile>
  );
});
