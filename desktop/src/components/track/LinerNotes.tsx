import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {dateFormatted, durLong} from '../../lib/formatters';
import {ChevronDown, ChevronUp, Hash} from '../../lib/icons';
import {getAlbumTarget} from '../../lib/track-display';
import type {Track} from '../../stores/player';
import {StatOrb} from '../user/StatOrb';
import type {TrackAura} from './useTrackAura';

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
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
        {label}
      </span>
            <span
                className={`text-[13px] truncate ${
                    onClick
                        ? 'text-white/75 hover:text-white cursor-pointer transition-colors'
                        : 'text-white/70 selectable'
                }`}
                onClick={onClick}
            >
        {value}
      </span>
        </div>
    );
}

/** The record-sleeve back: glanceable stats, the artist's written notes,
 *  credits-as-typography (album, release, language, ISRC…) and tags. */
export const LinerNotes = React.memo(function LinerNotes({
                                                             track,
                                                             aura,
                                                         }: {
    track: Track;
    aura: TrackAura;
}) {
    const {t} = useTranslation();
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
    if (released) credits.push({label: t('track.released'), value: released});
    if (track.language) credits.push({label: t('track.language'), value: track.language});
    if (full) credits.push({label: t('track.fullLength'), value: durLong(full)});
    if (isrc) credits.push({label: t('track.isrc'), value: isrc});

    return (
        <section className="glass rounded-[2rem] p-6 md:p-7 space-y-6">
            <div className="flex flex-wrap gap-2.5">
                <StatOrb value={track.playback_count} label={t('track.plays')} accent={aura.accentGlow}/>
                <StatOrb
                    value={track.favoritings_count ?? track.likes_count}
                    label={t('track.likes')}
                    accent={aura.accentGlow}
                />
                {track.reposts_count != null && (
                    <StatOrb
                        value={track.reposts_count}
                        label={t('track.reposts')}
                        accent={aura.accentGlow}
                    />
                )}
                <StatOrb value={track.comment_count} label={t('track.comments')} accent={aura.accentGlow}/>
            </div>

            {desc && (
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-2.5">
                        {t('track.description')}
                    </h3>
                    <p
                        className={`selectable text-[13.5px] text-white/55 leading-relaxed whitespace-pre-wrap break-words ${
                            !expanded && descLong ? 'line-clamp-4' : ''
                        }`}
                    >
                        {desc}
                    </p>
                    {descLong && (
                        <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            className="flex items-center gap-1 mt-2 text-[11px] text-white/35 hover:text-white/60 transition-colors cursor-pointer"
                        >
                            {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                            {expanded ? t('track.showLess') : t('track.showMore')}
                        </button>
                    )}
                </div>
            )}

            {credits.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                    {credits.map((c) => (
                        <Credit key={c.label} {...c} />
                    ))}
                </div>
            )}

            {tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <Hash size={12} className="text-white/20"/>
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.05] hover:bg-white/[0.07] hover:text-white/60 transition-all duration-200 cursor-default"
                        >
              {tag}
            </span>
                    ))}
                </div>
            )}
        </section>
    );
});
