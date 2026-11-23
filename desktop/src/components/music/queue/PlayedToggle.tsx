import { useTranslation } from 'react-i18next';
import { ChevronDown, Clock } from '../../../lib/icons';

interface Props {
  count: number;
  open: boolean;
  at: number;
  onToggle: () => void;
}

export function PlayedToggle({ count, open, at, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-ui="queue-played"
      data-q-at={at}
      aria-expanded={open}
      onClick={onToggle}
      className="group flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-2 text-left outline-none transition-colors hover:bg-[var(--shell-fill)] focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Clock size={13} className="shrink-0 text-ink-40" />
      <span className="text-[12.5px] font-semibold text-ink-55 transition-colors group-hover:text-ink-80">
        {t('queue.played')}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-ink-30">{count}</span>
      <span className="flex-1" />
      <ChevronDown
        size={15}
        className={`shrink-0 text-ink-40 transition-transform duration-200 group-hover:text-ink-70 ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
}
