import {useCallback, useState} from 'react';
import {fetchAllLikedTracks, useLikedTracks} from '../../lib/hooks';
import {armLikesContinuation} from '../../lib/queue-continuation';
import {usePlayerStore} from '../../stores/player';

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function useShuffleLikes() {
    const {tracks: likedTracks} = useLikedTracks();
    const [loading, setLoading] = useState(false);

    const shuffle = useCallback(async () => {
        if (loading) return;
        usePlayerStore.setState({shuffle: true});
        const {play} = usePlayerStore.getState();

        if (likedTracks.length === 0) {
            setLoading(true);
            try {
                const all = await fetchAllLikedTracks();
                if (all.length === 0) return;
                play(pickRandom(all), all);
            } finally {
                setLoading(false);
            }
            return;
        }

        play(pickRandom(likedTracks), likedTracks);
        setLoading(true);
        try {
            await armLikesContinuation();
        } finally {
            setLoading(false);
        }
    }, [likedTracks, loading]);

    return {shuffle, loading};
}
