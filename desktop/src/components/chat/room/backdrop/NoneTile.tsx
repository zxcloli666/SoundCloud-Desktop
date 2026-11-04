import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban } from '../../../../lib/icons';
import { Tile } from './Tile';

export const NoneTile = memo(function NoneTile({
  cover,
  current,
  pending,
  onPick,
  onFocus,
}: {
  cover: string | null;
  current: boolean;
  pending: boolean;
  onPick: () => void;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const label = t('chat.backdrop.none');
  return (
    <Tile label={label} current={current} pending={pending} onPick={onPick} onFocus={onFocus}>
      <span className="absolute inset-0 bg-ink/[0.05]" />
      {cover && (
        <img
          src={cover}
          alt=""
          draggable={false}
          className="absolute -inset-3 h-[calc(100%+1.5rem)] w-[calc(100%+1.5rem)] max-w-none object-cover opacity-45"
          style={{ filter: 'blur(14px) saturate(1.4)' }}
        />
      )}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-60">
        <Ban size={16} />
        <span className="text-[11px] font-semibold text-ink-80">{label}</span>
      </span>
    </Tile>
  );
});
