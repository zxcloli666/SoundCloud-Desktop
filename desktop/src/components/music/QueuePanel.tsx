import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { ListMusic, Trash2, X } from '../../lib/icons';
import { usePlayerStore } from '../../stores/player';
import { RightPanelShell } from '../layout/RightPanelShell';
import { NowPlayingCard } from './queue/NowPlayingCard';
import { QueueList } from './queue/QueueList';

const NowPlayingSection = React.memo(() => {
  const { t } = useTranslation();
  const hasCurrentTrack = usePlayerStore((s) => s.currentTrack !== null);
  if (!hasCurrentTrack) return null;
  return (
    <div className="px-3.5 pb-2">
      <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-2 px-1.5">
        {t('player.nowPlaying')}
      </p>
      <NowPlayingCard />
    </div>
  );
});

/* ── Queue drawer ─────────────────────────────────────────────
 * Right-side glass drawer. The blur lives on its own GPU-isolated layer behind
 * an isolated content stack, so the scrolling list / drag never re-rasterizes
 * the backdrop. Pieces live in ./queue/*. */

export const QueuePanel = React.memo(
  ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const { t } = useTranslation();
    const { queueLength, queueIndex } = usePlayerStore(
      useShallow((s) => ({
        queueLength: s.queue.length,
        queueIndex: s.queueIndex,
      })),
    );

    const upNextCount = queueLength - queueIndex - 1;

    return (
      <RightPanelShell open={open} onClose={onClose} ariaLabel={t('player.queue')}>
        <div className="flex h-full min-h-0 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3" data-tauri-drag-region>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[15px] font-semibold tracking-tight text-white/90">
                {t('player.queue')}
              </h2>
              {queueLength > 0 && (
                <span className="text-[11px] font-semibold text-white/40 bg-white/[0.06] rounded-full px-2 py-0.5 tabular-nums">
                  {queueLength}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {queueLength > 0 && (
                <button
                  type="button"
                  onClick={() => usePlayerStore.getState().clearQueue()}
                  className="h-7 px-2.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  {t('player.clearQueue')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                title={t('common.close')}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Now Playing */}
          <NowPlayingSection />

          {/* Up Next */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-3.5 pb-4">
            {upNextCount > 0 && (
              <>
                <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-2 mt-3 px-1.5">
                  {t('player.upNext')} · {upNextCount}
                </p>
                <QueueList startIndex={queueIndex + 1} queueIndex={queueIndex} />
              </>
            )}

            {queueLength === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06] flex items-center justify-center">
                  <ListMusic size={24} className="text-white/15" />
                </div>
                <div>
                  <p className="text-[14px] text-white/40 font-medium">{t('player.queueEmpty')}</p>
                  <p className="text-[12px] text-white/20 mt-1 leading-relaxed max-w-[200px]">
                    {t('player.queueEmptyHint')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </RightPanelShell>
    );
  },
);
