import * as Popover from '@radix-ui/react-popover';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetTrackSharing } from '../../lib/hooks';
import { Ellipsis, Globe, Lock, Pencil, Trash2 } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import type { Track } from '../../stores/player';
import { DeleteTrackDialog } from './DeleteTrackDialog';
import { EditTrackDialog } from './EditTrackDialog';

const ITEM_CLASS =
  'group flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium transition-colors disabled:cursor-default disabled:opacity-50';

export const OwnerTrackMenu = React.memo(function OwnerTrackMenu({ track }: { track: Track }) {
  const { t } = useTranslation();
  const b = usePerfMode().blur(30);
  const sharing = useSetTrackSharing(track.urn);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isPrivate = track.sharing === 'private';

  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            title={t('track.manage')}
            aria-label={t('track.manage')}
            className={`cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              open
                ? 'text-white/85 bg-white/[0.08] opacity-100'
                : 'text-white/30 hover:text-white/80 hover:bg-white/[0.06] opacity-0 group-hover:opacity-100'
            }`}
          >
            <Ellipsis size={15} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="end"
            className="z-50 w-[210px] rounded-2xl p-1.5 outline-none animate-fade-in"
            style={{
              background: b > 0 ? 'rgba(18,18,22,0.88)' : 'rgb(22,22,26)',
              backdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
              WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <button
              type="button"
              onClick={pick(() => setEditing(true))}
              className={`${ITEM_CLASS} text-white/65 hover:bg-white/[0.06] hover:text-white/92`}
            >
              <span className="text-white/35 transition-colors group-hover:text-accent">
                <Pencil size={14} />
              </span>
              {t('track.edit')}
            </button>
            <button
              type="button"
              disabled={sharing.isPending}
              onClick={pick(() => sharing.mutate(isPrivate ? 'public' : 'private'))}
              className={`${ITEM_CLASS} text-white/65 hover:bg-white/[0.06] hover:text-white/92`}
            >
              <span className="text-white/35 transition-colors group-hover:text-accent">
                {isPrivate ? <Globe size={14} /> : <Lock size={14} />}
              </span>
              {isPrivate ? t('sharing.makePublic') : t('sharing.makePrivate')}
            </button>
            <div className="h-px bg-white/[0.06] mx-2 my-1" />
            <button
              type="button"
              onClick={pick(() => setDeleting(true))}
              className={`${ITEM_CLASS} text-red-400/80 hover:bg-red-500/10 hover:text-red-400`}
            >
              <Trash2 size={14} />
              {t('track.delete')}
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {editing && <EditTrackDialog track={track} open={editing} onOpenChange={setEditing} />}
      <DeleteTrackDialog track={track} open={deleting} onOpenChange={setDeleting} />
    </>
  );
});
