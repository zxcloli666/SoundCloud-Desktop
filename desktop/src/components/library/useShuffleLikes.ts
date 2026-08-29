import {useCallback, useState} from 'react';
import {fetchAllLikedTracks, useLikedTracks} from '../../lib/hooks';
import {armLikesContinuation} from '../../lib/queue-continuation';
import {getPlayerQueueRevision, usePlayerStore} from '../../stores/player';

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
        const startedRevision = getPlayerQueueRevision();
        armLikesContinuation();

        setLoading(true);
        try {
            const all = await fetchAllLikedTracks();
            const {queue, addToQueue} = usePlayerStore.getState();
            if (getPlayerQueueRevision() !== startedRevision) return;
            const queued = new Set(queue.map((t) => t.urn));
            const rest = all.filter((t) => !queued.has(t.urn));
            if (rest.length > 0) addToQueue(rest);
        } catch (e) {
            console.debug('[likes] full-collection fetch failed, staying on lazy continuation:', e);
        } finally {
            setLoading(false);
        }
    }, [likedTracks, loading]);

    return {shuffle, loading};
}
