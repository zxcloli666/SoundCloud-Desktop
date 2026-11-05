import { useEffect } from 'react';
import { useChatStore } from '../../../stores/chat';
import { useChatMediaStore } from '../../../stores/chat/media';
import { type StorageMeter, storageMeter } from './storage-meter';

export function useStorageMeter(): StorageMeter | null {
  const media = useChatStore((state) => state.config?.media ?? null);
  const usage = useChatMediaStore((state) => state.usage);

  const hasMedia = media !== null;
  useEffect(() => {
    if (hasMedia) void useChatMediaStore.getState().refreshUsage();
  }, [hasMedia]);

  return storageMeter(media, usage);
}
