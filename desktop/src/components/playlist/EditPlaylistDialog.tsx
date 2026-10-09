import * as Dialog from '@radix-ui/react-dialog';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type Playlist, useUpdatePlaylistDetails } from '../../lib/hooks';
import { Pencil, X } from '../../lib/icons';

const FIELD_CLASS =
  'w-full bg-white/[0.04] text-[13.5px] text-white/90 placeholder:text-white/25 px-3.5 py-2.5 rounded-xl outline-none border border-white/[0.07] focus:border-accent/40 focus:bg-white/[0.06] transition-colors disabled:opacity-60';

function EditPlaylistForm({ playlist, onDone }: { playlist: Playlist; onDone: () => void }) {
  const { t } = useTranslation();
  const update = useUpdatePlaylistDetails(playlist.urn);
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? '');

  const nextTitle = title.trim();
  const nextDescription = description.trim();
  const changed =
    nextTitle !== playlist.title || nextDescription !== (playlist.description ?? '').trim();
  const canSave = nextTitle.length > 0 && changed && !update.isPending;

  const save = () => {
    if (!canSave) return;
    update.mutate(
      { title: nextTitle, description: nextDescription },
      {
        onSuccess: () => {
          toast.success(t('playlist.detailsSaved'));
          onDone();
        },
      },
    );
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {t('playlist.titleLabel')}
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('playlist.playlistName')}
          className={FIELD_CLASS}
          disabled={update.isPending}
          autoFocus
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {t('playlist.descriptionLabel')}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder={t('playlist.descriptionPlaceholder')}
          rows={4}
          className={`${FIELD_CLASS} resize-none leading-relaxed`}
          disabled={update.isPending}
        />
      </label>
      <div className="flex items-center justify-end gap-2.5 pt-1">
        <Dialog.Close
          type="button"
          className="px-4 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          {t('common.cancel')}
        </Dialog.Close>
        <button
          type="submit"
          disabled={!canSave}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent text-accent-contrast hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {update.isPending ? t('playlist.saving') : t('playlist.save')}
        </button>
      </div>
    </form>
  );
}

export const EditPlaylistDialog = React.memo(function EditPlaylistDialog({
  playlist,
  open,
  onOpenChange,
}: {
  playlist: Playlist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] max-w-[calc(100vw-32px)] rounded-2xl glass border border-white/[0.08] shadow-2xl animate-fade-in-up p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
              <Pencil size={17} className="text-accent" />
            </div>
            <Dialog.Title className="text-[15px] font-bold text-white/90">
              {t('playlist.edit')}
            </Dialog.Title>
            <Dialog.Close
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all cursor-pointer"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </Dialog.Close>
          </div>
          <EditPlaylistForm playlist={playlist} onDone={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
