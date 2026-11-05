import { chatBridge } from '../../../lib/chat/bridge';
import type { ConvId } from '../../../lib/chat/types';

const focused: ConvId[] = [];

function report() {
  void chatBridge.focus(focused[focused.length - 1] ?? null).catch(() => undefined);
}

export function focusThread(conversationId: ConvId): () => void {
  focused.push(conversationId);
  report();
  return () => {
    const index = focused.lastIndexOf(conversationId);
    if (index >= 0) focused.splice(index, 1);
    report();
  };
}
