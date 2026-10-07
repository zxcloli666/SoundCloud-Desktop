import * as Popover from '@radix-ui/react-popover';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, ListPlus, Plus } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useLocalLibrary } from '../../../stores/local-library';
import { PlaylistNameInput } from './PlaylistNameInput';

export const AddToLocalPlaylist = React.memo(function AddToLocalPlaylist({
  trackId,
  className,
}: {
  trackId: string;
  className: string;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const playlists = useLocalLibrary((s) => s.playlists);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const b = perf.blur(30);

  const add = (id: string, title: string) => {
    const added = useLocalLibrary.getState().addToPlaylist(id, [trackId]);
    setOpen(false);
    toast.success(t(added > 0 ? 'local.addedToPlaylist' : 'local.alreadyInPlaylist', { title }));
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCreating(false);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          title={t('local.addToPlaylist')}
          aria-label={t('local.addToPlaylist')}
          className={className}
        >
          <ListPlus size={13} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-[230px] rounded-2xl p-1.5 outline-none"
          style={{
            background: b > 0 ? 'rgba(18,18,22,0.88)' : 'rgb(22,22,26)',
            backdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
            WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div className="px-2.5 pb-1.5 pt-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {t('local.addToPlaylist')}
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {playlists.map((playlist) => {
              const inside = playlist.trackIds.includes(trackId);
              return (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => add(playlist.id, playlist.title)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12.5px] font-medium text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white/92"
                >
                  <span className="truncate">{playlist.title}</span>
                  {inside && (
                    <Check
                      size={12}
                      className="flex-none"
                      style={{ color: 'var(--color-accent)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {creating ? (
            <PlaylistNameInput
              initial=""
              className="p-1"
              onCancel={() => setCreating(false)}
              onSubmit={(title) => {
                setCreating(false);
                setOpen(false);
                useLocalLibrary.getState().createPlaylist(title, [trackId]);
                toast.success(t('local.addedToPlaylist', { title }));
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-0.5 flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12.5px] font-semibold transition-colors hover:bg-white/[0.05]"
              style={{ color: 'var(--color-accent-hover)' }}
            >
              <Plus size={13} />
              {t('local.newPlaylist')}
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
