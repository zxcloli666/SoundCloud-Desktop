import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { dateFormatted, durLong } from '../../lib/formatters';
import { ChevronDown, ChevronUp, Hash } from '../../lib/icons';
import { getAlbumTarget } from '../../lib/track-display';
import type { Track } from '../../stores/player';
import { RichText } from '../ui/RichText';
import { StatOrb } from '../user/StatOrb';

function parseTags(tagList?: string): string[] {
  if (!tagList) return [];
  const tags: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tagList))) tags.push(m[1] || m[2]);
  return tags;
}

function Credit({
  label,
  value,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-40">
        {label}
      </span>
      <span
        className={`text-[13px] truncate ${
          onClick
            ? 'text-ink-75 hover:text-ink cursor-pointer transition-colors'
            : 'text-ink-70 selectable'
        }`}
        onClick={onClick}
      >
        {value}
      </span>
    </div>
  );
}

export const LinerNotes = React.memo(function LinerNotes({
  track,
  onSeek,
}: {
  track: Track;
  onSeek: (seconds: number) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const desc = track.description?.trim();
  const descLong = !!desc && desc.length > 280;
  const tags = parseTags(track.tag_list);

  const album = track.enrichment?.album;
  const albumTarget = getAlbumTarget(track);
  const released = track.release_date
    ? dateFormatted(track.release_date)
    : track.release_year
      ? String(track.release_year)
      : null;
  const full =
    track.full_duration && track.full_duration !== track.duration ? track.full_duration : null;
  const isrc = track.publisher_metadata?.isrc;

  const credits: { label: string; value: React.ReactNode; onClick?: () => void }[] = [];
  if (album?.title)
    credits.push({
      label: t('track.album'),
      value: album.title,
      onClick: albumTarget ? () => navigate(albumTarget) : undefined,
    });
  if (released) credits.push({ label: t('track.released'), value: released });
  if (track.language) credits.push({ label: t('track.language'), value: track.language });
  if (full) credits.push({ label: t('track.fullLength'), value: durLong(full) });
  if (isrc) credits.push({ label: t('track.isrc'), value: isrc });

  return (
    <section className="space-y-6 rounded-3xl border border-ink/[0.08] bg-ink/[0.025] p-6 @min-[512px]:p-7">
      <div className="flex flex-wrap gap-2.5">
        <StatOrb value={track.playback_count} label={t('track.plays')} />
        <StatOrb value={track.favoritings_count ?? track.likes_count} label={t('track.likes')} />
        {track.reposts_count != null && (
          <StatOrb value={track.reposts_count} label={t('track.reposts')} />
        )}
        <StatOrb value={track.comment_count} label={t('track.comments')} />
      </div>

      {desc && (
        <div>
          <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-40">
            {t('track.description')}
          </h3>
          <p
            className={`selectable text-[13.5px] text-ink-65 leading-relaxed whitespace-pre-wrap break-words ${
              !expanded && descLong ? 'line-clamp-4' : ''
            }`}
          >
            <RichText text={desc} maxSeconds={track.duration / 1000} onSeek={onSeek} />
          </p>
          {descLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 flex cursor-pointer items-center gap-1 text-[11px] text-ink-40 transition-colors hover:text-ink-70"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? t('track.showLess') : t('track.showMore')}
            </button>
          )}
        </div>
      )}

      {credits.length > 0 && (
        <div className="grid grid-cols-2 @min-[512px]:grid-cols-3 gap-x-8 gap-y-4">
          {credits.map((c) => (
            <Credit key={c.label} {...c} />
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <Hash size={12} className="text-ink-30" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="cursor-default rounded-full border border-ink/[0.06] bg-ink/[0.04] px-2.5 py-1 text-[10.5px] font-medium text-ink-50"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  );
});
