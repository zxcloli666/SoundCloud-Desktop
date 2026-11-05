import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ConvId } from '../../../lib/chat/types';
import { Fullscreen, PictureInPicture2, X } from '../../../lib/icons';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { lastOutsidePath } from './useDockMode';
import { chatPath } from './useOpenChat';

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 transition-colors hover:bg-ink/[0.08] hover:text-ink-90"
    >
      {children}
    </button>
  );
}

export const PageThreadActions = memo(function PageThreadActions({
  conversationId,
}: {
  conversationId: ConvId;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const toDock = () => {
    useChatPrefsStore.getState().openInDock(conversationId);
    navigate(lastOutsidePath());
  };

  return (
    <ActionButton label={t('chat.list.dock.toDock')} onClick={toDock}>
      <PictureInPicture2 size={16} />
    </ActionButton>
  );
});

export const DockThreadActions = memo(function DockThreadActions({
  conversationId,
}: {
  conversationId: ConvId;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <ActionButton
        label={t('chat.list.dock.expand')}
        onClick={() => navigate(chatPath(conversationId))}
      >
        <Fullscreen size={15} />
      </ActionButton>
      <ActionButton
        label={t('chat.list.dock.closeTab')}
        onClick={() => useChatPrefsStore.getState().closeTab(conversationId)}
      >
        <X size={15} />
      </ActionButton>
    </>
  );
});
