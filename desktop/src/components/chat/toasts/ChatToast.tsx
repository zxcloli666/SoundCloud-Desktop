import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from '../../../lib/chat/icons';
import { surface } from '../../../lib/chat/tone';
import type { NotifyPrefs, PreviewMode } from '../../../lib/chat/types';
import { X } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useChatListStore } from '../../../stores/chat/list';
import { useObsStatusStore } from '../../../stores/obs-status';
import { ConversationAvatar } from '../list/ConversationAvatar';
import { conversationAvatar, conversationTitle } from '../list/conversation-meta';
import { QuickReply } from './QuickReply';
import { ToastActions } from './ToastActions';
import { ToastPreview } from './ToastPreview';
import { type ChatToastItem, useChatToastStore } from './toast-store';

const DISMISS_MS = 6500;
const DISMISS_MIN_MS = 1500;

function previewMode(prefs: NotifyPrefs | undefined, live: boolean): PreviewMode {
  const mode = prefs?.preview ?? 'full';
  if (mode === 'full' && live && prefs?.streamMode) return 'name_only';
  return mode;
}

interface ChatToastProps {
  item: ChatToastItem;
  prefs: NotifyPrefs | undefined;
  onOpen: (conversationId: string) => void;
}

export const ChatToast = memo(function ChatToast({ item, prefs, onOpen }: ChatToastProps) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const blur = perf.blur(30);
  const conversation = useChatListStore((state) => state.byId[item.conversationId]);
  const live = useObsStatusStore((state) => state.status?.server === 'running');
  const dismiss = useChatToastStore((state) => state.dismiss);
  const [hover, setHover] = useState(false);
  const [replying, setReplying] = useState(false);
  const id = item.conversationId;

  useEffect(() => {
    if (hover || replying) return;
    const left = Math.max(DISMISS_MIN_MS, DISMISS_MS - (Date.now() - item.updatedAt));
    const timer = setTimeout(() => dismiss(id), left);
    return () => clearTimeout(timer);
  }, [hover, replying, dismiss, id, item.updatedAt]);

  if (!conversation) return null;
  const mode = previewMode(prefs, live);
  const anonymous = mode === 'hidden';
  const title = anonymous ? t('chat.notify.newMessage') : conversationTitle(conversation, t);
  const close = () => dismiss(id);

  return (
    <div
      data-ui="chat-toast"
      role="status"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="chat-motion pointer-events-auto relative w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[1.4rem] border border-ink/[0.1]"
      style={{
        boxShadow: '0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        animation: perf.mode === 'light' ? undefined : 'chat-pop 420ms var(--ease-apple) both',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          contain: 'strict',
          transform: 'translateZ(0)',
          background: blur > 0 ? surface(9, 78) : surface(9, 97),
          backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.5)` : undefined,
          WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.5)` : undefined,
        }}
      />
      <span
        aria-hidden
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: 'var(--color-accent)' }}
      />
      <div className="relative flex flex-col gap-2.5 p-3.5" style={{ isolation: 'isolate' }}>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              onOpen(id);
              close();
            }}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
          >
            <span className="relative shrink-0">
              {anonymous ? (
                <span className="flex size-10 items-center justify-center rounded-full bg-ink/[0.08] text-ink-60">
                  <MessageCircle size={17} />
                </span>
              ) : (
                <ConversationAvatar
                  kind={conversation.kind}
                  src={conversationAvatar(conversation)}
                  name={title}
                  size={40}
                />
              )}
              {item.count > 1 && (
                <span className="absolute -right-1.5 -bottom-1 rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-bold leading-4 text-[var(--color-accent-contrast)] tabular-nums">
                  {t('chat.notify.more', { n: item.count - 1 })}
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13.5px] font-bold text-ink-92">{title}</span>
              {!anonymous && <ToastPreview message={item.message} mode={mode} />}
            </span>
          </button>
          <button
            type="button"
            onClick={close}
            aria-label={t('chat.notify.close')}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-35 hover:bg-ink/[0.08] hover:text-ink-80"
          >
            <X size={12} />
          </button>
        </div>
        {replying ? (
          <QuickReply conversationId={id} onSent={close} onCancel={() => setReplying(false)} />
        ) : (
          <ToastActions conversationId={id} onReply={() => setReplying(true)} onDone={close} />
        )}
      </div>
    </div>
  );
});
