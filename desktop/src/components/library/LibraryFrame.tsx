import {memo, type ReactNode} from 'react';
import {usePerfMode} from '../../lib/perf';
import {Atmosphere} from '../search/Atmosphere';
import {LIBRARY_KEYFRAMES} from './keyframes';
import type {Soundprint} from './useSoundprint';

/** Shared shell for every Library surface — the genre-aura atmosphere bled to
 *  the collection's dominant hue, plus the isolated content column. The hub and
 *  the deep pages all wear the same room. */
export const LibraryFrame = memo(function LibraryFrame({
                                                           sound,
                                                           page = 'library',
                                                           children,
                                                       }: {
    sound: Soundprint;
    page?: 'library' | 'history';
    children: ReactNode;
}) {
    const perf = usePerfMode();
    return (
        <div data-ui="page" data-page={page} className="relative min-h-full w-full">
            <style>{LIBRARY_KEYFRAMES}</style>
            {perf.atmosphere && <Atmosphere tint={sound.tint} energy={sound.energy}/>}
            <div
                className="relative z-10 min-h-full max-w-[1320px] mx-auto px-4 md:px-8 pt-5 pb-6"
                style={{isolation: 'isolate'}}
            >
                {children}
            </div>
        </div>
    );
});
