import { toast } from 'sonner';
import i18n from '../../../i18n';
import { usePlayerStore } from '../../../stores/player';

const UNDO_MS = 5000;

export function clearQueueWithUndo() {
  const { queue, queueIndex, originalQueue, queueOrigins, currentTrack } =
    usePlayerStore.getState();
  if (queue.length === 0) return;
  usePlayerStore.getState().clearQueue();

  const restore = () => {
    const now = usePlayerStore.getState().currentTrack;
    const at = now ? queue.findIndex((track) => track.urn === now.urn) : -1;
    usePlayerStore.setState({
      queue,
      originalQueue,
      queueOrigins,
      queueIndex: now?.urn === currentTrack?.urn ? queueIndex : at,
    });
  };

  toast(i18n.t('queue.cleared', { count: queue.length }), {
    duration: UNDO_MS,
    action: { label: i18n.t('queue.undo'), onClick: restore },
  });
}
