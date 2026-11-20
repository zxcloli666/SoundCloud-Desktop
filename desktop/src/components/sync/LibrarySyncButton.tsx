import { useTranslation } from 'react-i18next';
import { Clock, RefreshCw } from '../../lib/icons';
import { useLibrarySync } from '../../lib/library-sync';
import { usePerfMode } from '../../lib/perf';

const PILL =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10.5px] font-medium tabular-nums outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent/60';

export function LibrarySyncButton({ enabled }: { enabled: boolean }) {
  const { t, i18n } = useTranslation();
  const perf = usePerfMode();
  const { supported, ready, availableAt, pending, press } = useLibrarySync(enabled);
  if (!supported) return null;

  const time = new Date(availableAt).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <button
      type="button"
      data-ui="library-sync-now"
      data-state={pending ? 'pending' : ready ? 'ready' : 'cooldown'}
      title={ready ? t('syncNow.hint') : t('syncNow.next', { time })}
      onClick={() => press()}
      disabled={!ready || pending}
      className={`${PILL} border-ink/10 bg-ink/[0.04] text-ink-65 cursor-pointer enabled:hover:border-ink/30 enabled:hover:text-ink-90 disabled:cursor-default disabled:opacity-60`}
    >
      {ready || pending ? (
        <RefreshCw
          size={11}
          className={
            pending && perf.idleAnim ? 'animate-spin [animation-duration:1.2s]' : undefined
          }
        />
      ) : (
        <Clock size={11} />
      )}
      {ready || pending ? t('syncNow.label') : time}
    </button>
  );
}
