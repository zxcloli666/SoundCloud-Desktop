import { useTranslation } from 'react-i18next';
import { Send } from '../../../lib/chat/icons';
import { openShare } from '../../../lib/chat/share';
import type { Embed } from '../../../lib/chat/types';
import { selectChatEnabled, useChatStore } from '../../../stores/chat';

interface ShareButtonProps {
  embed: Embed | null;
  size: number;
  className: string;
}

export function ShareButton({ embed, size, className }: ShareButtonProps) {
  const { t } = useTranslation();
  const enabled = useChatStore(selectChatEnabled);
  if (!enabled || !embed) return null;
  const label = t('chat.embeds.share.action');
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => openShare(embed)}
      className={className}
    >
      <Send size={size} />
    </button>
  );
}
