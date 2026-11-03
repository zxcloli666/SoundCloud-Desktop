import React from 'react';
import {useTranslation} from 'react-i18next';
import {useUserPlaylists} from '../../lib/hooks';
import {PlaylistCard} from '../music/PlaylistCard';
import {HorizontalScroll} from '../ui/HorizontalScroll';

/** The curator's wider body of work — more crates they dug. */
export const MoreCrates = React.memo(function MoreCrates({
                                                             curatorUrn,
                                                             curatorName,
                                                             excludeUrn,
                                                         }: {
    curatorUrn: string;
    curatorName: string;
    excludeUrn: string;
}) {
    const {t} = useTranslation();
    const {playlists} = useUserPlaylists(curatorUrn);
    const others = (playlists ?? []).filter((p) => p.urn !== excludeUrn).slice(0, 12);

    if (others.length === 0) return null;

    return (
        <section className="space-y-3">
            <h2 className="text-[14px] font-bold text-ink-70 px-1">
                {t('playlist.moreCrates', {name: curatorName})}
            </h2>
            <HorizontalScroll className="-mx-1 px-1">
                <div className="flex gap-4">
                    {others.map((p) => (
                        <div key={p.urn} className="w-[176px] shrink-0">
                            <PlaylistCard playlist={p} showPlayback/>
                        </div>
                    ))}
                </div>
            </HorizontalScroll>
        </section>
    );
});
