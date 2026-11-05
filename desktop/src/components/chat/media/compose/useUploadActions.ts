import { useChatStore } from '../../../../stores/chat';
import { uploadActionsRun } from '../../../../stores/chat/account';
import { useChatMediaStore } from '../../../../stores/chat/media';

export function useUploadActions(): boolean {
  const phase = useChatStore((state) => state.status?.phase ?? null);
  const local = useChatMediaStore((state) => state.local);
  return uploadActionsRun(phase, local);
}
