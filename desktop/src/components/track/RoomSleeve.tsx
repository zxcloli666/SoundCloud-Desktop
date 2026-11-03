import React from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {art, fc} from '../../lib/formatters';
import {Loader2} from '../../lib/icons';
import type {Track} from '../../stores/player';
import {RelatedRow} from './RelatedRow';
import type {TrackAura} from './useTrackAura';

interface FavUser {
    urn: string;
    username: string;
    avatar_url: string;
}

const PANEL = {
    background: 'rgb(var(--ink) / 0.035)',
    border: '0.5px solid rgb(var(--ink) / 0.07)',
} as const;

/** The sleeve: who made it, who else was in the room, and where to go next. */
export const RoomSleeve = React.memo(function RoomSleeve({
                                                             track,
                                                             favoriters,
                                                             related,
                                                             relatedLoading,
                                                             aura,
                                                         }: {
    track: Track;
    favoriters: FavUser[];
    related: Track[];
    relatedLoading: boolean;
    aura: TrackAura;
}) {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const u = track.user;

    const shown = favoriters.slice(0, 8);
    const total = track.favoritings_count ?? track.likes_count ?? favoriters.length;
    const extra = Math.max(0, total - shown.length);

    return (
        <div className="space-y-5">
            <button
                type="button"
                onClick={() => navigate(`/user/${encodeURIComponent(u.urn)}`)}
                className="group/ac w-full rounded-[1.5rem] p-6 flex flex-col items-center text-center gap-3.5 transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 cursor-pointer"
                style={PANEL}
            >
                <img
                    src={art(u.avatar_url, 't200x200') ?? ''}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover ring-1 ring-ink/[0.12] transition-transform duration-500 group-hover/ac:scale-105"
                    style={{boxShadow: `0 14px 36px ${aura.accentGlow}`}}
                />
                <div>
                    <p className="text-[15px] font-bold text-ink-90 group-hover/ac:text-ink transition-colors">
                        {u.username}
                    </p>
                    {(u.followers_count != null || u.track_count != null) && (
                        <p className="text-[11px] text-ink-35 tabular-nums mt-1">
                            {u.followers_count != null && `${fc(u.followers_count)} ${t('user.followers')}`}
                            {u.followers_count != null && u.track_count != null && ' · '}
                            {u.track_count != null && `${fc(u.track_count)} ${t('user.tracks')}`}
                        </p>
                    )}
                </div>
            </button>

            {shown.length > 0 && (
                <div className="rounded-[1.5rem] p-5" style={PANEL}>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-40 mb-3.5">
                        {t('track.whoVibes')}
                    </h3>
                    <div className="flex items-center">
                        <div className="flex -space-x-3">
                            {shown.map((fu) => (
                                <button
                                    type="button"
                                    key={fu.urn}
                                    title={fu.username}
                                    onClick={() => navigate(`/user/${encodeURIComponent(fu.urn)}`)}
                                    className="relative hover:z-10 cursor-pointer transition-transform duration-200 hover:scale-110"
                                >
                                    <img
                                        src={art(fu.avatar_url, 'small') ?? ''}
                                        alt={fu.username}
                                        loading="lazy"
                                        className="w-9 h-9 rounded-full object-cover ring-2 ring-black/40 hover:ring-ink/30 transition-all duration-200"
                                    />
                                </button>
                            ))}
                        </div>
                        {extra > 0 && (
                            <span
                                className="ml-3.5 text-[12px] font-semibold tabular-nums"
                                style={{color: aura.accent}}
                            >
                +{fc(extra)}
              </span>
                        )}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-40 mb-3 px-1">
                    {t('track.related')}
                </h3>
                {relatedLoading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 size={16} className="text-ink-15 animate-spin"/>
                    </div>
                ) : related.length === 0 ? (
                    <p className="text-[12px] text-ink-25 px-1">{t('track.relatedEmpty')}</p>
                ) : (
                    <div className="space-y-1">
                        {related.map((rt) => (
                            <RelatedRow key={rt.urn} track={rt} queue={related}/>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});
