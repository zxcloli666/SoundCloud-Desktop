import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { art } from '../../lib/formatters';
import { type HistoryEntry, useHistory, useInfiniteScroll } from '../../lib/hooks';
import { Loader2, Music, playWhite14 } from '../../lib/icons';
import { usePlayerStore } from '../../stores/player';
import { VirtualList } from '../ui/VirtualList';
import { formatHistoryDate, historyEntryToTrack, historyTrackUrn } from './history-utils';

export const HistoryTab = React.memo(function HistoryTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const play = usePlayerStore((s) => s.play);
  const historyQuery = useHistory();
  const { entries, isLoading } = historyQuery;
  const sentinelRef = useInfiniteScroll(
    !!historyQuery.hasNextPage,
    !!historyQuery.isFetchingNextPage,
    historyQuery.fetchNextPage,
  );

  const handleClearHistory = useCallback(async () => {
    await api('/history', { method: 'DELETE' });
    historyQuery.refetch();
  }, [historyQuery]);

  const rows = useMemo(() => {
    const flat: Array<
      | { type: 'header'; id: string; label: string }
      | { type: 'entry'; id: string; entry: HistoryEntry }
    > = [];
    let currentLabel = '';

    for (const entry of entries) {
      const label = formatHistoryDate(entry.playedAt, t);
      if (label !== currentLabel) {
        currentLabel = label;
        flat.push({ type: 'header', id: `header:${label}`, label });
      }
      flat.push({ type: 'entry', id: entry.id, entry });
    }

    return flat;
  }, [entries, t]);

  return (
    <div className="min-h-[400px]">
      {entries.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleClearHistory}
            className="text-[12px] text-white/30 hover:text-red-400 transition-colors cursor-pointer"
          >
            {t('library.clearHistory')}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-white/20" />
        </div>
      ) : rows.length > 0 ? (
        <VirtualList
          items={rows}
          rowHeight={60}
          overscan={10}
          className="flex flex-col"
          disabled={rows.length < 60}
          getItemKey={(row) => row.id}
          renderItem={(row) =>
            row.type === 'header' ? (
              <div className="py-3">
                <h3 className="text-[13px] font-bold text-white/30 uppercase tracking-wider px-1">
                  {row.label}
                </h3>
              </div>
            ) : (
              <div className="group flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/[0.04] transition-all duration-300">
                <button
                  type="button"
                  className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md cursor-pointer"
                  onClick={() => {
                    const tracks = entries.map(historyEntryToTrack);
                    const idx = entries.findIndex((e) => e.id === row.entry.id);
                    play(tracks[idx], tracks);
                  }}
                >
                  {row.entry.artworkUrl ? (
                    <img
                      src={art(row.entry.artworkUrl, 't200x200') ?? ''}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.05] to-transparent">
                      <Music size={14} className="text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                    {playWhite14}
                  </div>
                </button>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p
                    className="text-[14px] font-medium truncate text-white/90 hover:text-white cursor-pointer transition-colors"
                    onClick={() =>
                      navigate(`/track/${encodeURIComponent(historyTrackUrn(row.entry.scTrackId))}`)
                    }
                  >
                    {row.entry.title}
                  </p>
                  <p
                    className={`text-[12px] text-white/40 truncate mt-0.5${row.entry.artistUrn ? ' hover:text-white/60 cursor-pointer transition-colors' : ''}`}
                    onClick={() =>
                      row.entry.artistUrn &&
                      navigate(`/user/${encodeURIComponent(row.entry.artistUrn)}`)
                    }
                  >
                    {row.entry.artistName}
                  </p>
                </div>

                <span className="text-[11px] text-white/20 tabular-nums shrink-0">
                  {new Date(row.entry.playedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )
          }
        />
      ) : (
        <div className="py-20 text-center text-white/20">{t('library.historyEmpty')}</div>
      )}

      <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
        {historyQuery.isFetchingNextPage && (
          <Loader2 size={20} className="text-white/15 animate-spin" />
        )}
      </div>
    </div>
  );
});
