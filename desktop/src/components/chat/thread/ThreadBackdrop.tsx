import { memo } from 'react';
import type { ConversationSummary } from '../../../lib/chat/types';
import { useChatStore } from '../../../stores/chat';
import { reportsBackdrop } from '../backdrop/access';
import { BackdropDialogs } from '../backdrop/BackdropDialogs';
import { BackdropLayer } from '../backdrop/BackdropLayer';
import { UploadChip } from '../backdrop/UploadChip';
import { useChatTarget } from '../backdrop/useChatTarget';

export function hasOwnBackdrop(conversation: ConversationSummary): boolean {
  return ['direct', 'group', 'self', 'public'].includes(conversation.kind);
}

export const ThreadBackdrop = memo(function ThreadBackdrop({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  return <BackdropLayer conversationId={conversation.id} backdrop={conversation.backdrop} />;
});

export const ThreadBackdropDialogs = memo(function ThreadBackdropDialogs({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  const me = useChatStore((state) => state.status?.userId ?? null);
  const target = useChatTarget(conversation);
  return (
    <>
      {target.access !== 'role' && (
        <div className="pointer-events-none absolute inset-x-0 top-[58px] z-10">
          <UploadChip conversationId={conversation.id} scope={conversation.id} />
        </div>
      )}
      <BackdropDialogs
        scope={conversation.id}
        target={target}
        reportable={reportsBackdrop(conversation, me)}
      />
    </>
  );
});
