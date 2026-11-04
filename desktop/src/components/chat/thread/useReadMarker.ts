import { useEffect } from 'react';
import type { ConvId } from '../../../lib/chat/types';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { lastSeqUpTo, type Row } from './rows';

function canRead(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

export function useReadMarker(
  conversationId: ConvId,
  rows: Row[],
  endIndex: number,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || endIndex < 0) return;
    const mark = () => {
      if (!canRead()) return;
      const seq = lastSeqUpTo(rows, endIndex);
      if (seq !== null) useChatThreadStore.getState().markRead(conversationId, seq);
    };
    mark();
    window.addEventListener('focus', mark);
    document.addEventListener('visibilitychange', mark);
    return () => {
      window.removeEventListener('focus', mark);
      document.removeEventListener('visibilitychange', mark);
    };
  }, [conversationId, rows, endIndex, enabled]);
}
