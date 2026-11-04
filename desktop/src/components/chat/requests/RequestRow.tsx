import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatRequest, ConvId } from '../../../lib/chat/types';
import { Avatar } from '../../ui/Avatar';
import { RequestActions } from './RequestActions';

interface RequestRowProps {
  request: ChatRequest;
  selected: boolean;
  onOpen: (conversationId: ConvId) => void;
}

export const RequestRow = memo(function RequestRow({ request, selected, onOpen }: RequestRowProps) {
  const { t } = useTranslation();
  const { conversation, from } = request;
  const group = conversation.kind === 'group';
  const preview = conversation.preview?.kind === 'text' ? conversation.preview.text : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(conversation.id)}
      onKeyDown={(event) => event.key === 'Enter' && onOpen(conversation.id)}
      className={`group mx-2 my-1 flex cursor-pointer flex-col gap-2 rounded-2xl border px-3 py-2.5 transition-colors duration-200 ${
        selected
          ? 'border-ink/[0.12] bg-ink/[0.07]'
          : 'border-ink/[0.05] bg-ink/[0.025] hover:bg-ink/[0.05]'
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar src={from.avatarUrl} alt={from.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-ink-90">{from.name}</p>
          <p className="truncate text-[11.5px] text-ink-40">
            {group
              ? t('chat.list.requests.groupInvite', { name: conversation.title ?? '' })
              : t('chat.list.requests.messages', { count: request.messages })}
          </p>
        </div>
      </div>
      {preview && (
        <p className="line-clamp-2 rounded-xl bg-shade-15 px-3 py-2 text-[12.5px] leading-snug break-words text-ink-60">
          {preview}
        </p>
      )}
      <div className="flex justify-end">
        <RequestActions conversation={conversation} from={from} wide />
      </div>
    </div>
  );
});
