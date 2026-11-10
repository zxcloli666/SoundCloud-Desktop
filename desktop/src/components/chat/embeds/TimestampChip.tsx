import { useTranslation } from 'react-i18next';
import { durLong } from '../../../lib/formatters';
import { Play } from '../../../lib/icons';

interface TimestampChipProps {
  atMs: number;
  onPlay: () => void;
  disabled?: boolean;
}

export function TimestampChip({ atMs, onPlay, disabled = false }: TimestampChipProps) {
  const { t } = useTranslation();
  const time = durLong(atMs);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onPlay();
      }}
      aria-label={t('chat.embeds.track.from', { time })}
      title={t('chat.embeds.track.from', { time })}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold tabular-nums text-accent transition-colors duration-200 cursor-pointer hover:bg-accent/20 disabled:cursor-default disabled:opacity-40"
      style={{
        background: 'var(--color-accent-glow)',
        boxShadow: 'inset 0 0 0 0.5px var(--color-accent-selection)',
      }}
    >
      <Play size={10} fill="currentColor" strokeWidth={0} />
      {time}
    </button>
  );
}
