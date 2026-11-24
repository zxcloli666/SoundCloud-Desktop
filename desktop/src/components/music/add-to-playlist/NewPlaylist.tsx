import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { art } from '../../../lib/formatters';
import { useCreatePlaylist } from '../../../lib/hooks';
import { Globe, ListMusic, Loader2, Lock, X } from '../../../lib/icons';
import type { Track } from '../../../stores/player';
import { Choice } from './Choice';

type Sharing = 'public' | 'private';

export function NewPlaylist({
  track,
  name,
  onClose,
}: {
  track: Track;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(name);
  const [sharing, setSharing] = useState<Sharing>('public');
  const create = useCreatePlaylist();
  const cover = art(track.artwork_url, 't200x200');
  const ready = title.trim() !== '' && !create.isPending;

  const submit = () => {
    if (!ready) return;
    create.mutate(
      { title: title.trim(), sharing, trackUrns: [track.urn] },
      {
        onSuccess: (result) => {
          toast.success(
            t(result?.status === 'queued' ? 'playlist.createQueued' : 'playlist.created'),
          );
          onClose();
        },
      },
    );
  };

  return (
    <form
      data-ui="playlist-picker-new"
      className="mx-3 mb-2 shrink-0 rounded-2xl bg-ink/[0.045] p-3 ring-1 ring-ink/[0.07]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="flex items-center gap-3.5">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/[0.06] ring-1 ring-ink/[0.08]">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" decoding="async" />
          ) : (
            <ListMusic size={22} className="text-ink-25" />
          )}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('playlist.playlistName')}
          aria-label={t('playlist.playlistName')}
          disabled={create.isPending}
          autoFocus
          className="min-w-0 flex-1 rounded-none border-b border-ink/[0.14] bg-transparent py-2 text-[16px] font-semibold text-ink-95 outline-none transition-colors placeholder:font-medium placeholder:text-ink-30 focus:border-accent"
        />
        <button
          type="button"
          onClick={onClose}
          disabled={create.isPending}
          title={t('common.cancel')}
          aria-label={t('common.cancel')}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center self-start rounded-full text-ink-40 transition-colors hover:bg-ink/[0.08] hover:text-ink-90"
        >
          <X size={15} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Choice
          data-ui="playlist-picker-sharing"
          label={t('playlist.newPlaylist')}
          value={sharing}
          onChange={setSharing}
          options={[
            { id: 'public', label: t('playlist.public'), icon: <Globe size={13} /> },
            { id: 'private', label: t('playlist.private'), icon: <Lock size={13} /> },
          ]}
        />
        <button
          type="submit"
          disabled={!ready}
          className="ml-auto flex h-[38px] cursor-pointer items-center gap-2 rounded-xl bg-accent px-5 text-[12.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-40"
        >
          {create.isPending && <Loader2 size={13} className="animate-spin" />}
          {t('playlist.create')}
        </button>
      </div>
    </form>
  );
}
