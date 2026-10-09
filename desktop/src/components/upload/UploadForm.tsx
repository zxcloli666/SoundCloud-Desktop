import * as Dialog from '@radix-ui/react-dialog';
import { open } from '@tauri-apps/plugin-dialog';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines, Globe, ImageIcon, Lock, Shield, Upload, X } from '../../lib/icons';
import { formatTagList, splitTagInput } from '../../lib/track-edits';
import {
  ARTWORK_EXTENSIONS,
  AUDIO_EXTENSIONS,
  fileNameOf,
  titleFromFile,
} from '../../lib/track-upload';
import { useTrackUploadStore } from '../../stores/track-upload';
import { FIELD_CLASS, FieldLabel, TagPreview } from '../track/track-form';

async function pickFile(name: string, extensions: string[]): Promise<string | null> {
  const picked = await open({ multiple: false, directory: false, filters: [{ name, extensions }] });
  return typeof picked === 'string' ? picked : null;
}

function AudioPicker({ onPick }: { onPick: (path: string) => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={async () => {
        const path = await pickFile(t('upload.audioFiles'), AUDIO_EXTENSIONS);
        if (path) onPick(path);
      }}
      className="group w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] hover:bg-accent/[0.06] hover:border-accent/40 transition-all duration-300 cursor-pointer"
    >
      <span className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center text-accent transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
        <Upload size={22} />
      </span>
      <span className="text-[14px] font-semibold text-white/85">{t('upload.chooseAudio')}</span>
      <span className="text-[11.5px] text-white/35">{t('upload.formats')}</span>
    </button>
  );
}

function FileCard({ path, onChange }: { path: string; onChange: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
      <span className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center text-accent shrink-0">
        <AudioLines size={16} />
      </span>
      <span className="flex-1 min-w-0 truncate text-[13px] text-white/80">{fileNameOf(path)}</span>
      <button
        type="button"
        onClick={onChange}
        className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white/50 hover:text-white/85 hover:bg-white/[0.06] transition-all cursor-pointer"
      >
        {t('upload.change')}
      </button>
    </div>
  );
}

function ArtworkTile({
  path,
  onPick,
  onClear,
}: {
  path: string | null;
  onPick: (path: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const pick = async () => {
    const picked = await pickFile(t('upload.images'), ARTWORK_EXTENSIONS);
    if (picked) onPick(picked);
  };
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={pick}
        title={path ? fileNameOf(path) : t('upload.addArtwork')}
        className={`w-[104px] h-[104px] rounded-2xl flex flex-col items-center justify-center gap-1.5 px-2 text-center transition-all duration-300 cursor-pointer ${
          path
            ? 'bg-accent/[0.12] border border-accent/30 text-accent'
            : 'bg-white/[0.03] border border-dashed border-white/[0.12] text-white/35 hover:text-white/70 hover:border-white/25'
        }`}
      >
        <ImageIcon size={20} />
        <span className="text-[10.5px] font-medium leading-tight line-clamp-2 break-all">
          {path ? fileNameOf(path) : t('upload.addArtwork')}
        </span>
      </button>
      {path && (
        <button
          type="button"
          onClick={onClear}
          aria-label={t('upload.removeArtwork')}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white/60 hover:text-white cursor-pointer"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

function PrivacySwitch({
  value,
  onChange,
}: {
  value: 'public' | 'private';
  onChange: (value: 'public' | 'private') => void;
}) {
  const { t } = useTranslation();
  const options = [
    { id: 'public' as const, icon: <Globe size={13} />, label: t('sharing.public') },
    { id: 'private' as const, icon: <Lock size={13} />, label: t('sharing.private') },
  ];
  return (
    <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
            value === option.id
              ? 'bg-white/[0.1] text-white/90 shadow-sm'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const UploadForm = React.memo(function UploadForm() {
  const { t } = useTranslation();
  const start = useTrackUploadStore((s) => s.start);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [artworkPath, setArtworkPath] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [sharing, setSharing] = useState<'public' | 'private'>('public');

  const pickAudio = (path: string) => {
    setFilePath(path);
    if (!title.trim()) setTitle(titleFromFile(path));
  };

  if (!filePath) return <AudioPicker onPick={pickAudio} />;

  const canUpload = title.trim().length > 0;
  const submit = () => {
    if (!canUpload) return;
    void start(filePath, artworkPath, {
      title,
      description,
      genre,
      tag_list: formatTagList(splitTagInput(tags)),
      sharing,
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <FileCard
        path={filePath}
        onChange={async () => {
          const path = await pickFile(t('upload.audioFiles'), AUDIO_EXTENSIONS);
          if (path) setFilePath(path);
        }}
      />
      <div className="flex gap-4">
        <ArtworkTile
          path={artworkPath}
          onPick={setArtworkPath}
          onClear={() => setArtworkPath(null)}
        />
        <div className="flex-1 min-w-0 space-y-3">
          <label className="block space-y-1.5">
            <FieldLabel>{t('track.titleLabel')}</FieldLabel>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FIELD_CLASS}
              maxLength={200}
              autoFocus
            />
          </label>
          <PrivacySwitch value={sharing} onChange={setSharing} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <FieldLabel>{t('track.genreLabel')}</FieldLabel>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder={t('track.genrePlaceholder')}
            className={FIELD_CLASS}
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
          />
        </label>
      </div>
      <TagPreview input={tags} />
      <label className="block space-y-1.5">
        <FieldLabel>{t('track.descriptionLabel')}</FieldLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('track.descriptionPlaceholder')}
          rows={3}
          className={`${FIELD_CLASS} resize-none leading-relaxed`}
        />
      </label>
      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
        <Shield size={14} className="text-amber-300/80 shrink-0 mt-0.5" />
        <p className="text-[11.5px] leading-relaxed text-white/55">{t('upload.rights')}</p>
      </div>
      <div className="flex items-center justify-end gap-2.5 pt-1">
        <Dialog.Close
          type="button"
          className="px-4 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          {t('common.cancel')}
        </Dialog.Close>
        <button
          type="submit"
          disabled={!canUpload}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent text-accent-contrast hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <Upload size={14} />
          {t('upload.start')}
        </button>
      </div>
    </form>
  );
});
