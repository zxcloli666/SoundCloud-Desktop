import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvId } from '../../../lib/chat/types';
import { Ban } from '../../../lib/icons';
import { usePublicStore } from '../../../stores/chat/public';
import { PublicBannedBar, PublicMutedBar } from '../public/SanctionBar';
import { RequestBar } from '../requests/RequestBar';
import { useRoomSendLock } from '../room/useRoom';
import { useThread } from '../thread/context';
import { isActiveMember, isRequest } from '../thread/permissions';
import { Composer } from './Composer';

function GoneBar() {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 px-3 pt-2 pb-4 text-[12.5px] text-ink-40">
      <Ban size={14} />
      {t('chat.thread.notMember')}
    </div>
  );
}

export const ComposerGate = memo(function ComposerGate({
  conversationId,
}: {
  conversationId: ConvId;
}) {
  const { conversation } = useThread();
  const locked = useRoomSendLock(conversationId) !== null;
  const isPublic = conversation.kind === 'public';
  const mutedUntil = usePublicStore((state) => (isPublic ? state.mutedUntil : null));
  const muted = mutedUntil !== null && mutedUntil > Date.now();
  if (isPublic && conversation.state === 'banned') return <PublicBannedBar />;
  if (isPublic && muted && mutedUntil !== null) return <PublicMutedBar until={mutedUntil} />;
  if (isRequest(conversation)) return <RequestBar conversation={conversation} />;
  if (!isActiveMember(conversation)) return <GoneBar />;
  if (locked) return null;
  return <Composer conversationId={conversationId} />;
});
