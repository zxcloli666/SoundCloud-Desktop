import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { CircleCheck, HardDrive, Loader2, RefreshCw } from '../../../lib/icons';
import { useFormatSize } from './bytes';
import { Panel, PanelTitle } from './Panel';

type CacheState =
  | { kind: 'loading' }
  | { kind: 'ready'; bytes: number; freed: number | null }
  | { kind: 'clearing'; bytes: number }
  | { kind: 'failed' };

export const CacheCard = memo(function CacheCard() {
  const { t } = useTranslation();
  const format = useFormatSize();
  const [state, setState] = useState<CacheState>({ kind: 'loading' });

  const measure = useCallback(async (freed: number | null) => {
    try {
      setState({ kind: 'ready', bytes: await chatBridge.mediaCacheSize(), freed });
    } catch {
      setState({ kind: 'failed' });
    }
  }, []);

  useEffect(() => {
    void measure(null);
  }, [measure]);

  const clear = async () => {
    if (state.kind !== 'ready') return;
    setState({ kind: 'clearing', bytes: state.bytes });
    try {
      const freed = await chatBridge.mediaCacheClear();
      await measure(freed);
    } catch {
      setState({ kind: 'failed' });
    }
  };

  const bytes = state.kind === 'ready' || state.kind === 'clearing' ? state.bytes : null;

  return (
    <Panel ui="chat-storage-cache" className="p-4">
      <PanelTitle icon={<HardDrive size={13} />} title={t('chat.storage.cache.title')} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          {state.kind === 'failed' ? (
            <span className="text-[13px] font-medium text-bad">
              {t('chat.storage.cache.failed')}
            </span>
          ) : (
            <span className="text-[20px] font-bold tracking-tight tabular-nums text-ink-90">
              {bytes === null ? (
                <span className="inline-block h-5 w-16 rounded-md skeleton-shimmer align-middle" />
              ) : (
                format(bytes)
              )}
            </span>
          )}
          <span className="text-[11.5px] text-ink-45">{t('chat.storage.cache.desc')}</span>
        </div>
        {state.kind === 'failed' ? (
          <button
            type="button"
            onClick={() => {
              setState({ kind: 'loading' });
              void measure(null);
            }}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-ink/[0.06] px-3 py-2 text-[12px] font-semibold text-ink-75 outline-none hover:bg-ink/[0.1] focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <RefreshCw size={12} />
            {t('chat.storage.retry')}
          </button>
        ) : (
          <button
            type="button"
            disabled={state.kind !== 'ready' || state.bytes === 0}
            onClick={() => void clear()}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-ink/[0.06] px-3 py-2 text-[12px] font-semibold text-ink-75 outline-none transition-colors hover:bg-ink/[0.1] focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-default disabled:opacity-45"
          >
            {state.kind === 'clearing' && <Loader2 size={12} className="animate-spin" />}
            {t('chat.storage.cache.clear')}
          </button>
        )}
      </div>
      {state.kind === 'ready' && state.freed !== null && (
        <div
          className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-ok storage-motion"
          style={{ animation: 'storage-rise 360ms var(--ease-apple) both' }}
        >
          <CircleCheck size={13} />
          {t('chat.storage.cache.freed', { size: format(state.freed) })}
        </div>
      )}
    </Panel>
  );
});
