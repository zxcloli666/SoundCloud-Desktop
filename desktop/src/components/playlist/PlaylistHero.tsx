import React from 'react';
import {useTranslation} from 'react-i18next';
import {dateFormatted, durLong} from '../../lib/formatters';
import type {Playlist} from '../../lib/hooks';
import {Calendar, Clock, Library, Loader2, RefreshCw} from '../../lib/icons';
import type {PlaylistDelivery} from '../../lib/playlist-delivery';
import {releaseKindOf} from '../../lib/playlist-kind';
import type {ArrangeMode} from '../../lib/track-order';
import type {Track} from '../../stores/player';
import {GlassHeroPanel} from '../ui/GlassHeroPanel';
import {CrateStack} from './CrateStack';
import {CuratorCard} from './CuratorCard';
import {PlaylistActions} from './PlaylistActions';
import type {PlaylistAura} from './usePlaylistAura';

function Meta({icon, children}: { icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55"
            style={{background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.07)'}}
        >
      {icon && <span className="text-white/45">{icon}</span>}
            {children}
    </span>
    );
}

function kindLabelKey(kind: string | undefined): { ns: string; defaultValue: string } {
    switch (kind) {
        case 'compilation':
            return {ns: 'playlist.kind.collection', defaultValue: 'Collection'};
        case 'album':
        case 'ep':
        case 'single':
            return {ns: `artist.kind.${kind}`, defaultValue: kind};
        default:
            return {ns: 'playlist.kind.set', defaultValue: 'Set'};
    }
}

export const PlaylistHero = React.memo(function PlaylistHero({
                                                                 playlist,
                                                                 tracks,
                                                                 aura,
                                                                 isOwner,
                                                                 isPlaying,
                                                                 isPinned,
                                                                 trackCount,
                                                                 onPlayAll,
                                                                 onShuffle,
                                                                 onTogglePin,
                                                                 onEdit,
                                                                 onDelete,
                                                                 canArrange,
                                                                 delivery,
                                                                 onArrange,
                                                             }: {
    playlist: Playlist;
    tracks: Track[];
    aura: PlaylistAura;
    isOwner: boolean;
    isPlaying: boolean;
    isPinned: boolean;
    trackCount: number;
    onPlayAll: () => void;
    onShuffle: () => void;
    onTogglePin: () => void;
    onEdit: () => void;
    onDelete: () => void;
    canArrange: boolean;
    delivery: PlaylistDelivery | null;
    onArrange: (mode: ArrangeMode) => void;
}) {
    const {t} = useTranslation();
    const kl = kindLabelKey(releaseKindOf(playlist) ?? playlist.kind);
    const hasGenres = aura.topGenres.length > 0;

    const titleStyle = hasGenres
        ? {
            background: aura.aura.nameGradient,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
        }
        : {color: '#fff', textShadow: '0 8px 24px rgba(0,0,0,0.5)'};

    return (
        <GlassHeroPanel hasStar={false} aura={aura.aura} className="p-6 md:p-10">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-start">
                <CrateStack
                    playlist={playlist}
                    tracks={tracks}
                    isPlaying={isPlaying}
                    trackCount={trackCount}
                    onPlay={onPlayAll}
                />

                <div className="flex-1 min-w-0 w-full flex flex-col gap-5 text-center lg:text-left">
                    <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
            <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.28em] text-white/70"
                style={{
                    background: 'rgba(255,255,255,0.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                }}
            >
              <Library size={11}/> {t(kl.ns, {defaultValue: kl.defaultValue})}
            </span>
                        {aura.topGenres.length > 1 && (
                            <span
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.16em] text-white/55"
                                style={{background: aura.accentGlow}}
                            >
                {t('playlist.spansGenres', {count: aura.topGenres.length})}
              </span>
                        )}
                    </div>

                    <h1
                        className="text-4xl md:text-6xl xl:text-7xl font-black leading-[0.9] tracking-tighter break-words"
                        style={titleStyle}
                    >
                        {playlist.title}
                    </h1>

                    {hasGenres && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-center lg:justify-start">
                            {aura.topGenres.map((g) => (
                                <span
                                    key={g.genre}
                                    className="inline-flex items-center gap-1.5 text-[11px] text-white/45"
                                >
                  <span
                      className="w-2 h-2 rounded-full"
                      style={{background: g.color, boxShadow: `0 0 8px ${g.color}`}}
                  />
                                    {g.genre}
                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
                        {playlist.duration > 0 && (
                            <Meta icon={<Clock size={11}/>}>{durLong(playlist.duration)}</Meta>
                        )}
                        {playlist.last_modified && (
                            <Meta icon={<Calendar size={11}/>}>
                                {t('playlist.lastEdited', {date: dateFormatted(playlist.last_modified)})}
                            </Meta>
                        )}
                        {playlist.label_name && <Meta>{playlist.label_name}</Meta>}
                        {delivery === 'sending' && (
                            <Meta icon={<Loader2 size={11} className="animate-spin"/>}>
                                {t('playlist.sendingToSoundCloud')}
                            </Meta>
                        )}
                        {delivery === 'blocked' && (
                            <Meta icon={<RefreshCw size={11}/>}>{t('playlist.notSentToSoundCloud')}</Meta>
                        )}
                    </div>

                    <div className="pt-1">
                        <PlaylistActions
                            playlist={playlist}
                            isOwner={isOwner}
                            isPlaying={isPlaying}
                            isPinned={isPinned}
                            tracks={tracks}
                            trackCount={trackCount}
                            onPlayAll={onPlayAll}
                            onShuffle={onShuffle}
                            onTogglePin={onTogglePin}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            canArrange={canArrange}
                            onArrange={onArrange}
                        />
                    </div>

                    <CuratorCard
                        user={playlist.user}
                        aura={aura.aura}
                        isOwner={isOwner}
                        note={playlist.description}
                    />
                </div>
            </div>
        </GlassHeroPanel>
    );
});
