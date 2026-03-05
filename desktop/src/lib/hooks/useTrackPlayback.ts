import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePlayerStore, type Track } from '../../stores/player'

export function useTrackPlayback(track: Track, queue: Track[]) {
    const { play, pause, resume, currentTrack, isPlaying } = usePlayerStore(
        useShallow((s) => ({
            play: s.play,
            pause: s.pause,
            resume: s.resume,
            currentTrack: s.currentTrack,
            isPlaying: s.isPlaying,
        }))
    )

    const isCurrent = currentTrack?.urn === track.urn
    const isCurrentPlaying = isCurrent && isPlaying

    const togglePlay = useCallback(
        (e?: { stopPropagation?: () => void }) => {
            e?.stopPropagation?.()
            if (isCurrent && isPlaying) pause()
            else if (isCurrent) resume()
            else play(track, queue)
        },
        [isCurrent, isPlaying, pause, resume, play, track, queue]
    )

    return { isCurrent, isCurrentPlaying, togglePlay }
}
