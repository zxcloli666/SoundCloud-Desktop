import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { art } from '../../lib/formatters';
import { type HistoryEntry, useHistory, useInfiniteScroll } from '../../lib/hooks';
import { ChartNoAxesColumn, Clock, Loader2, Music, playWhite14 } from '../../lib/icons';
import { openTrackMenu } from '../../lib/useTrackContextMenu';
import { usePlayerStore } from '../../stores/player';
import { ColumnHandle } from '../music/columns/ColumnHandle';
import { useColumnWidth } from '../music/columns/TrackColumns';
import { LikeButton } from '../music/LikeButton';
import { VirtualList } from '../ui/VirtualList';
import { formatHistoryDate, historyEntryToTrack } from './history-utils';
import { STATS_QUERY_KEY } from './stats/useListeningStats';

export const HistoryTab = React.memo(function HistoryTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const play = usePlayerStore((s) => s.play);
  const queryClient = useQueryClient();
  const historyQuery = useHistory();
  const timeWidth = useColumnWidth('time');
  const { entries, isLoading } = historyQuery;
  const sentinelRef = useInfiniteScroll(
    !!historyQuery.hasNextPage,
    !!historyQuery.isFetchingNextPage,
    historyQuery.fetchNextPage,
  );

  const handleClearHistory = useCallback(async () => {
    await api('/history', { method: 'DELETE' });
    historyQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: [STATS_QUERY_KEY] });
  }, [historyQuery, queryClient]);

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
        <div className="flex items-center justify-between mb-4">
          <Link to="/library/stats" className="chip-pill">
            <ChartNoAxesColumn size={14} />
            {t('stats.open')}
          </Link>
          <button type="button" onClick={handleClearHistory} className="chip-pill hover:text-bad">
            {t('library.clearHistory')}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-ink-20" />
        </div>
      ) : rows.length > 0 ? (
        <>
          <div className="mb-1 flex h-7 items-center gap-4 px-4 select-none">
            <div className="flex-1" />
            <div className="w-8 shrink-0" />
            <div
              className="relative flex shrink-0 items-center justify-end text-ink-30"
              style={{ width: timeWidth }}
            >
              <ColumnHandle id="time" width={timeWidth} />
              <Clock size={12} />
            </div>
          </div>
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
                  <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-40">
                    {row.label}
                  </h3>
                </div>
              ) : (
                <div
                  onContextMenu={(e) => openTrackMenu(e, historyEntryToTrack(row.entry))}
                  className="group flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors duration-200 hover:bg-ink/[0.04]"
                >
                  <button
                    type="button"
                    className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-ink/[0.08]"
                    onClick={() => {
                      const tracks = entries.map(historyEntryToTrack);
                      const idx = entries.findIndex((e) => e.id === row.entry.id);
                      play(tracks[idx], tracks);
                    }}
                  >
                    {row.entry.artworkUrl ? (
                      <img
                        data-ui="artwork"
                        src={art(row.entry.artworkUrl, 't200x200') ?? ''}
                        alt=""
                        className="w-full h-full object-cover"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-ink/[0.04]">
                        <Music size={14} className="text-ink-20" />
                      </div>
                    )}
                    <div
                      data-scheme="dark"
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {playWhite14}
                    </div>
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p
                      className="text-[14px] font-medium truncate text-ink-90 hover:text-ink cursor-pointer transition-colors"
                      onClick={() => navigate(`/track/${encodeURIComponent(row.entry.trackUrn)}`)}
                    >
                      {row.entry.title}
                    </p>
                    <p
                      className={`text-[12px] text-ink-40 truncate mt-0.5${row.entry.artistUrn ? ' hover:text-ink-60 cursor-pointer transition-colors' : ''}`}
                      onClick={() =>
                        row.entry.artistUrn &&
                        navigate(`/user/${encodeURIComponent(row.entry.artistUrn)}`)
                      }
                    >
                      {row.entry.artistName}
                    </p>
                  </div>

                  <LikeButton track={historyEntryToTrack(row.entry)} />

                  <span
                    className="shrink-0 text-right text-[11px] tabular-nums text-ink-35"
                    style={{ width: timeWidth }}
                  >
                    {new Date(row.entry.playedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )
            }
          />
        </>
      ) : (
        <div className="py-20 text-center text-[13px] text-ink-40">{t('library.historyEmpty')}</div>
      )}

      <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
        {historyQuery.isFetchingNextPage && (
          <Loader2 size={20} className="text-ink-15 animate-spin" />
        )}
      </div>
    </div>
  );
});
