import { useShallow } from 'zustand/shallow';
import { useChatMediaStore } from '../../../../stores/chat/media';
import type { AlbumFlags } from './staged';

export function useAlbumFlags(): AlbumFlags {
  return useChatMediaStore(
    useShallow((state) => ({
      sending: state.sending,
      parked: state.parked,
      parkedReady: state.parkedReady,
      dismissed: state.dismissed,
    })),
  );
}
