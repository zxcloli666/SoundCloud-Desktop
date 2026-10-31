import {Globe, Loader2, Lock} from 'lucide-react';
import React from 'react';
import {useTranslation} from 'react-i18next';

import {useSetPlaylistSharing, useSetTrackSharing} from '../../lib/hooks';

type Props = {
    kind: 'track' | 'playlist';
    urn: string;
    sharing: string | undefined;
};

/** Owner-only тоггл приватности (public ⇄ private) для своего трека/плейлиста.
 *  Икон-кнопка в стиле utility-rail. Оба хука зовём безусловно (rules-of-hooks),
 *  «лишний» с undefined-urn просто не триггерится. */
export const SharingToggle = React.memo(function SharingToggle({kind, urn, sharing}: Props) {
    const {t} = useTranslation();
    const trackMut = useSetTrackSharing(kind === 'track' ? urn : undefined);
    const playlistMut = useSetPlaylistSharing(kind === 'playlist' ? urn : undefined);
    const mut = kind === 'track' ? trackMut : playlistMut;

    const isPrivate = sharing === 'private';
    const label = isPrivate ? t('sharing.makePublic') : t('sharing.makePrivate');

    return (
        <button
            type="button"
            disabled={mut.isPending}
            onClick={() => mut.mutate(isPrivate ? 'public' : 'private')}
            title={label}
            aria-label={label}
            className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer disabled:opacity-50 disabled:cursor-default ${
                isPrivate
                    ? 'text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10'
                    : 'text-ink-55 hover:text-ink-90 hover:bg-ink/[0.07]'
            }`}
        >
            {mut.isPending ? (
                <Loader2 size={15} className="animate-spin"/>
            ) : isPrivate ? (
                <Lock size={15}/>
            ) : (
                <Globe size={15}/>
            )}
        </button>
    );
});
