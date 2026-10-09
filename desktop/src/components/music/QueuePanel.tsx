import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import {getWallpaperUrl} from '../../lib/cache';
import {ListMusic, Trash2, X} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import { usePlayerStore } from '../../stores/player';
import {useSettingsStore} from '../../stores/settings';
import {CrossfadeImage} from '../ui/CrossfadeImage';
import {AutoplayRow} from './queue/AutoplayRow';
import {NowPlayingCard} from './queue/NowPlayingCard';
import {QueueList} from './queue/QueueList';

/* ── Queue drawer ─────────────────────────────────────────────
 * Right-side glass drawer. The blur lives on its own GPU-isolated layer behind
 * an isolated content stack, so the scrolling list / drag never re-rasterizes
 * the backdrop. Pieces live in ./queue/*. */

export const QueuePanel = React.memo(
  ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const { t } = useTranslation();
      const perf = usePerfMode();
      const panelBlur = perf.blur(60);
      const bgName = useSettingsStore((s) => s.backgroundImage);
      const wallpaperUrl = bgName ? getWallpaperUrl(bgName) : null;
      const {currentTrack, queueLength, queueIndex, isPlaying} = usePlayerStore(
      useShallow((s) => ({
        currentTrack: s.currentTrack,
          queueLength: s.queue.length,
        queueIndex: s.queueIndex,
          isPlaying: s.isPlaying,
      })),
    );

      const upNextCount = queueLength - queueIndex - 1;

    return (
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />

        {/* Panel */}
        <div
            data-ui="queue"
            className="fixed top-0 right-0 bottom-0 w-[360px] z-50 flex flex-col border-l border-white/[0.06]"
          style={{
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            visibility: open ? 'visible' : 'hidden',
            transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), visibility 300ms',
          }}
        >
            {/* GPU-isolated frost layer (no dynamic children). With a wallpaper we
              paint it directly (heavily blurred + veil) so the drawer shows the
              wallpaper instead of a flat dark frost; otherwise backdrop-blur of
              the app behind. */}
            <div
                className="absolute inset-0 overflow-hidden"
                style={{contain: 'strict', transform: 'translateZ(0)'}}
            >
                {wallpaperUrl ? (
                    <>
                        <CrossfadeImage
                            src={wallpaperUrl}
                            fade={perf.mode !== 'light'}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{
                                filter: panelBlur > 0 ? `blur(${panelBlur}px) saturate(1.15)` : undefined,
                                transform: 'scale(1.15) translateZ(0)',
                            }}
                        />
                        <div
                            className="absolute inset-0"
                            style={{
                                background: `linear-gradient(to left, rgba(14,14,18,${panelBlur > 0 ? 0.58 : 0.82}), rgba(14,14,18,${panelBlur > 0 ? 0.72 : 0.92}))`,
                            }}
                        />
                    </>
                ) : (
                    <div
                        className="absolute inset-0"
                        style={{
                            background: panelBlur > 0 ? 'rgba(16, 16, 20, 0.82)' : 'rgba(16, 16, 20, 0.98)',
                            backdropFilter: panelBlur > 0 ? `blur(${panelBlur}px) saturate(1.6)` : undefined,
                            WebkitBackdropFilter:
                                panelBlur > 0 ? `blur(${panelBlur}px) saturate(1.6)` : undefined,
                        }}
                    />
                )}
            </div>
            {/* accent edge glow */}
            <div
                className="absolute inset-y-0 left-0 w-px pointer-events-none"
                style={{
                    background:
                        'linear-gradient(to bottom, transparent, var(--color-accent) 45%, transparent)',
                    opacity: 0.4,
                }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full" style={{isolation: 'isolate'}}>
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 pt-5 pb-3"
                    data-tauri-drag-region
                >
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-[15px] font-semibold tracking-tight text-white/90">
                            {t('player.queue')}
                        </h2>
                        {queueLength > 0 && (
                            <span
                                className="text-[11px] font-semibold text-white/40 bg-white/[0.06] rounded-full px-2 py-0.5 tabular-nums">
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
                        <Trash2 size={12}/>
                        {t('player.clearQueue')}
                    </button>
                )}
                        <button
                            type="button"
                            onClick={onClose}
                            title={t('common.close')}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150 cursor-pointer"
                        >
                            <X size={16}/>
                        </button>
                    </div>
                </div>

                {/* Now Playing */}
                {currentTrack && (
                    <div className="px-3.5 pb-2">
                        <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-2 px-1.5">
                            {t('player.nowPlaying')}
                        </p>
                        <NowPlayingCard/>
                    </div>
                )}

                {/* Up Next */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-3.5 pb-4">
                    {upNextCount > 0 && (
                        <>
                            <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-2 mt-3 px-1.5">
                                {t('player.upNext')} · {upNextCount}
                            </p>
                            <QueueList
                                startIndex={queueIndex + 1}
                                queueIndex={queueIndex}
                                isPlaying={isPlaying}
                  />
                        </>
                    )}

                    {currentTrack && <AutoplayRow/>}

              {queueLength === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                      <div
                          className="w-14 h-14 rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06] flex items-center justify-center">
                          <ListMusic size={24} className="text-white/15"/>
                      </div>
                      <div>
                          <p className="text-[14px] text-white/40 font-medium">
                              {t('player.queueEmpty')}
                          </p>
                          <p className="text-[12px] text-white/20 mt-1 leading-relaxed max-w-[200px]">
                              {t('player.queueEmptyHint')}
                          </p>
                      </div>
                  </div>
              )}
                </div>
          </div>
        </div>
      </>
    );
  },
);
