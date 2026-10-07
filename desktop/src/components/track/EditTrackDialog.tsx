import * as Dialog from '@radix-ui/react-dialog';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUpdateTrackDetails } from '../../lib/hooks';
import { Pencil, X } from '../../lib/icons';
import { formatTagList, parseTagList, splitTagInput } from '../../lib/track-edits';
import type { Track } from '../../stores/player';
import { FIELD_CLASS, FieldLabel, TagPreview } from './track-form';

function EditTrackForm({ track, onDone }: { track: Track; onDone: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateTrackDetails(track.urn);
  const [title, setTitle] = useState(track.title);
  const [description, setDescription] = useState(track.description ?? '');
  const [genre, setGenre] = useState(track.genre ?? '');
  const [tags, setTags] = useState(parseTagList(track.tag_list).join(', '));

  const next = {
    title: title.trim(),
    description: description.trim(),
    genre: genre.trim(),
    tag_list: formatTagList(splitTagInput(tags)),
  };
  const changed =
    next.title !== track.title ||
    next.description !== (track.description ?? '').trim() ||
    next.genre !== (track.genre ?? '').trim() ||
    next.tag_list !== formatTagList(parseTagList(track.tag_list));
  const canSave = next.title.length > 0 && changed && !update.isPending;

  const save = () => {
    if (!canSave) return;
    update.mutate(next, {
      onSuccess: () => {
        toast.success(t('track.detailsSaved'));
        onDone();
      },
    });
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
        <FieldLabel>{t('track.titleLabel')}</FieldLabel>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={FIELD_CLASS}
          disabled={update.isPending}
          maxLength={200}
          autoFocus
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <FieldLabel>{t('track.genreLabel')}</FieldLabel>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder={t('track.genrePlaceholder')}
            className={FIELD_CLASS}
            disabled={update.isPending}
            maxLength={100}
          />
        </label>
        <label className="block space-y-1.5">
          <FieldLabel>{t('track.tagsLabel')}</FieldLabel>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t('track.tagsPlaceholder')}
            className={FIELD_CLASS}
            disabled={update.isPending}
          />
        </label>
      </div>
      <TagPreview input={tags} />
      <label className="block space-y-1.5">
        <FieldLabel>{t('track.descriptionLabel')}</FieldLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder={t('track.descriptionPlaceholder')}
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
          {update.isPending ? t('track.saving') : t('track.save')}
        </button>
      </div>
    </form>
  );
}

export const EditTrackDialog = React.memo(function EditTrackDialog({
  track,
  open,
  onOpenChange,
}: {
  track: Track;
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
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[500px] max-w-[calc(100vw-32px)] rounded-2xl glass border border-white/[0.08] shadow-2xl animate-fade-in-up p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
              <Pencil size={17} className="text-accent" />
            </div>
            <Dialog.Title className="text-[15px] font-bold text-white/90">
              {t('track.edit')}
            </Dialog.Title>
            <Dialog.Close
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all cursor-pointer"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </Dialog.Close>
          </div>
          <EditTrackForm track={track} onDone={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
