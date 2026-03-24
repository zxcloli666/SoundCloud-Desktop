import * as Dialog from '@radix-ui/react-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { api, getSessionId } from '../../lib/api';
import { API_BASE } from '../../lib/constants';
import { X } from '../../lib/icons';

interface YmProgress {
  total: number;
  current: number;
  found: number;
  not_found: number;
  current_track: string;
}

interface ScPlaylist {
  urn: string;
  title: string;
  track_count: number;
  artwork_url: string | null;
  permalink_url: string;
  user: { username: string };
}

const PLAYLIST_NAME = 'Yandex Music';
const PLAYLIST_TRACK_LIMIT = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getPlaylistName(index: number): string {
  return index === 0 ? PLAYLIST_NAME : `${PLAYLIST_NAME} ${index + 1}`;
}

function getPlaylistChunkIndex(title: string): number | null {
  if (title === PLAYLIST_NAME) return 0;
  const match = /^Yandex Music (\d+)$/.exec(title);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 2 ? parsed - 1 : null;
}

function YMImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<YmProgress | null>(null);
  const [done, setDone] = useState(false);
  const [playlist, setPlaylist] = useState<ScPlaylist | null>(null);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<YmProgress>('ym_import:progress', (e) => {
      setProgress(e.payload);
    }).then((fn) => {
      unlisten = fn;
      unlistenRef.current = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const findExistingPlaylists = useCallback(async (): Promise<ScPlaylist[]> => {
    try {
      const all: ScPlaylist[] = [];
      let cursor: string | undefined;

      for (;;) {
        const params = new URLSearchParams({ limit: '200', linked_partitioning: 'true' });
        if (cursor) params.set('cursor', cursor);

        const res = await api<{ collection: ScPlaylist[]; next_href?: string | null }>(
          `/me/playlists?${params}`,
        );
        all.push(...(res.collection ?? []));

        if (!res.next_href) break;
        const next = new URL(res.next_href).searchParams.get('cursor');
        if (!next || next === cursor) break;
        cursor = next;
      }

      return all
        .filter((p) => getPlaylistChunkIndex(p.title) != null)
        .sort(
          (a, b) => (getPlaylistChunkIndex(a.title) ?? 0) - (getPlaylistChunkIndex(b.title) ?? 0),
        );
    } catch {
      return [];
    }
  }, []);

  const createOrUpdatePlaylist = useCallback(
    async (urns: string[]) => {
      setSaving(true);
      try {
        // YM gives old -> new here; in SC we want newest at the top.
        const orderedUrns = [...urns].reverse();
        const chunks = chunkArray(orderedUrns, PLAYLIST_TRACK_LIMIT);
        const existing = await findExistingPlaylists();
        const results: ScPlaylist[] = [];

        for (let index = 0; index < chunks.length; index++) {
          const chunk = chunks[index] ?? [];
          const trackObjects = chunk.map((urn) => ({ urn }));
          const title = getPlaylistName(index);
          const existingPlaylist = existing.find((playlist) => playlist.title === title) ?? null;

          let result: ScPlaylist;
          if (existingPlaylist) {
            result = await api<ScPlaylist>(
              `/playlists/${encodeURIComponent(existingPlaylist.urn)}`,
              {
                method: 'PUT',
                body: JSON.stringify({ playlist: { tracks: trackObjects } }),
              },
            );
          } else {
            result = await api<ScPlaylist>('/playlists', {
              method: 'POST',
              body: JSON.stringify({
                playlist: {
                  title,
                  sharing: 'private',
                  tracks: trackObjects,
                },
              }),
            });
          }

          results.push(result);
        }

        const stalePlaylists = existing.filter((playlist) => {
          const index = getPlaylistChunkIndex(playlist.title);
          return index != null && index >= chunks.length;
        });

        await Promise.all(
          stalePlaylists.map((playlist) =>
            api(`/playlists/${encodeURIComponent(playlist.urn)}`, { method: 'DELETE' }).catch(
              () => undefined,
            ),
          ),
        );

        setPlaylist(results[0] ?? null);
        setPlaylistCount(results.length);
      } catch (e) {
        console.error('[YM Import] playlist save failed:', e);
      } finally {
        setSaving(false);
      }
    },
    [findExistingPlaylists],
  );

  const handleStart = useCallback(async () => {
    if (!token.trim()) return;
    setRunning(true);
    setDone(false);
    setProgress(null);
    setPlaylist(null);
    setPlaylistCount(0);
    try {
      const urns: string[] = await invoke('ym_import_start', {
        ymToken: token.trim(),
        backendUrl: API_BASE,
        sessionId: getSessionId() || '',
      });
      setDone(true);
      setRunning(false);
      if (urns.length > 0) {
        await createOrUpdatePlaylist(urns);
      }
    } catch (e) {
      console.error('[YM Import]', e);
      setRunning(false);
    }
  }, [token, createOrUpdatePlaylist]);

  const handleStop = useCallback(() => {
    invoke('ym_import_stop').catch(console.error);
    setRunning(false);
  }, []);

  const handleGoToPlaylist = useCallback(() => {
    if (!playlist) return;
    onOpenChange(false);
    navigate(`/playlist/${encodeURIComponent(playlist.urn)}`);
  }, [playlist, navigate, onOpenChange]);

  const pct =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="dialog-content fixed z-[80] top-1/2 left-1/2 w-full max-w-[520px] bg-[#1a1a1e]/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-7 pt-6 pb-4 border-b border-white/[0.06] flex items-center justify-between">
            <Dialog.Title className="text-[18px] font-bold text-white/90 tracking-tight">
              {t('settings.importYandex')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-all cursor-pointer">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-7 py-5 space-y-5">
            {/* Playlist result card */}
            {playlist ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
                <div className="relative p-5 flex items-center gap-4">
                  {/* Playlist artwork */}
                  <div className="w-16 h-16 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                    {playlist.artwork_url ? (
                      <img
                        src={playlist.artwork_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg
                        className="w-7 h-7 text-accent/60"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-white/90 truncate">{playlist.title}</p>
                    <p className="text-[12px] text-white/40 mt-0.5">
                      {progress?.found || 0} {t('search.tracks').toLowerCase()}
                      {playlistCount > 1
                        ? ` • ${playlistCount} ${t('search.playlists').toLowerCase()}`
                        : ''}
                    </p>
                    <p className="text-[11px] text-green-400/80 mt-1">{t('ym.done')}</p>
                  </div>
                  <button
                    onClick={handleGoToPlaylist}
                    className="px-4 py-2 rounded-xl bg-accent/20 hover:bg-accent/30 text-[13px] font-semibold text-accent border border-accent/10 transition-all cursor-pointer shrink-0"
                  >
                    {t('common.seeAll')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Instructions */}
                <div className="space-y-2 text-[13px] text-white/50">
                  <p className="font-medium text-white/70">{t('ym.instructions')}</p>
                  <ol className="list-decimal list-inside space-y-1 text-[12px]">
                    <li>{t('ym.step1')}</li>
                    <li>{t('ym.step2')}</li>
                    <li>{t('ym.step3')}</li>
                  </ol>
                </div>

                {/* Token input */}
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t('ym.tokenPlaceholder')}
                  disabled={running}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[13px] text-white/80 placeholder:text-white/20 focus:border-white/[0.12] focus:bg-white/[0.06] transition-all duration-200 outline-none disabled:opacity-50"
                />
              </>
            )}

            {/* Progress */}
            {progress && !playlist && (
              <div className="space-y-3">
                <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[12px] text-white/40">
                  <span>
                    {progress.current} / {progress.total}
                  </span>
                  <span className="text-green-400">
                    {t('ym.found')}: {progress.found}
                  </span>
                  <span className="text-red-400">
                    {t('ym.notFound')}: {progress.not_found}
                  </span>
                </div>
                {progress.current_track && (
                  <p className="text-[12px] text-white/30 truncate">{progress.current_track}</p>
                )}
              </div>
            )}

            {saving && (
              <p className="text-[13px] text-white/50 animate-pulse">{t('ym.savingPlaylist')}</p>
            )}
          </div>

          {/* Footer */}
          {!playlist && (
            <div className="px-7 py-4 border-t border-white/[0.06] flex justify-end gap-3">
              {running ? (
                <button
                  onClick={handleStop}
                  className="px-5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-[13px] font-semibold text-red-400 border border-red-500/10 transition-all cursor-pointer"
                >
                  {t('ym.stop')}
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={!token.trim() || done}
                  className="px-5 py-2 rounded-xl bg-accent/20 hover:bg-accent/30 text-[13px] font-semibold text-accent border border-accent/20 transition-all cursor-pointer disabled:opacity-30"
                >
                  {t('ym.start')}
                </button>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default YMImportDialog;
