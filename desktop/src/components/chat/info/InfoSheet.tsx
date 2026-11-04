import { memo, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { conversationAvatar, conversationTitle } from '../../../lib/chat/render';
import { surface } from '../../../lib/chat/tone';
import type { Seq } from '../../../lib/chat/types';
import { Bookmark, Images, ListMusic, Users, X } from '../../../lib/icons';
import { linkRoute } from '../../../lib/soundcloudLink';
import { useChatStore } from '../../../stores/chat';
import { selectMediaOn } from '../../../stores/chat/media';
import { Avatar } from '../../ui/Avatar';
import { GroupAvatarEdit } from '../media/compose/GroupAvatarEdit';
import { GalleryTab } from '../media/GalleryTab';
import { useThread } from '../thread/context';
import { GlassLayer } from '../thread/GlassLayer';
import { canManageMembers, hasTimer, isActiveMember } from '../thread/permissions';
import { InviteRow } from './InviteRow';
import { MembersTab } from './MembersTab';
import { MuteRow } from './MuteRow';
import { TimerPicker } from './TimerPicker';
import { TracksTab } from './TracksTab';

type Tab = 'tracks' | 'members' | 'gallery';

function Identity() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversation } = useThread();
  const avatar = conversationAvatar(conversation);
  const peer = conversation.kind === 'direct' ? conversation.peer : null;
  const route = peer ? linkRoute(`soundcloud:users:${peer.id}`) : null;

  return (
    <div className="flex flex-col items-center gap-2 px-4 pt-2 pb-4 text-center">
      {conversation.kind === 'group' ? (
        <GroupAvatarEdit conversation={conversation} />
      ) : (
        <button
          type="button"
          disabled={!route}
          onClick={() => route && navigate(route)}
          className="cursor-pointer rounded-full transition-transform duration-200 enabled:hover:scale-[1.03] disabled:cursor-default"
        >
          {conversation.kind === 'self' ? (
            <span
              className="flex size-[72px] items-center justify-center rounded-full"
              style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
            >
              <Bookmark size={28} />
            </span>
          ) : avatar || conversation.kind === 'direct' ? (
            <Avatar src={avatar} size={72} />
          ) : (
            <span className="flex size-[72px] items-center justify-center rounded-full bg-ink/[0.07] text-ink-45">
              <Users size={28} />
            </span>
          )}
        </button>
      )}
      <div className="max-w-full truncate text-[17px] font-bold tracking-tight text-ink-92">
        {conversationTitle(conversation, t)}
      </div>
      {(conversation.kind === 'group' || conversation.kind === 'room') && (
        <div className="text-[12px] text-ink-40">
          {t('chat.thread.members', { count: conversation.memberCount })}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold transition-colors duration-150 ${
        active ? 'bg-ink/[0.09] text-white' : 'text-ink-45 hover:text-ink-75'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export const InfoSheet = memo(function InfoSheet({
  onClose,
  onJump,
}: {
  onClose: () => void;
  onJump: (seq: Seq) => void;
}) {
  const { t } = useTranslation();
  const { conversation } = useThread();
  const scrollRef = useRef<HTMLDivElement>(null);
  const showMembers = conversation.kind !== 'self';
  const showGallery = useChatStore(selectMediaOn);
  const [tab, setTab] = useState<Tab>('tracks');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label={t('chat.thread.info.close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45"
      />
      <aside
        data-ui="chat-info"
        role="dialog"
        aria-label={t('chat.thread.menu.info')}
        className="chat-thread-motion relative flex h-full w-full max-w-[380px] flex-col border-l border-ink/[0.06] shadow-[-24px_0_60px_rgba(0,0,0,0.45)]"
        style={{ animation: 'chat-thread-sheet 220ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        <GlassLayer blur={36} tint={surface(7, 82)} solid={surface(7)} />
        <div className="relative flex min-h-0 flex-1 flex-col" style={{ isolation: 'isolate' }}>
          <div className="flex h-12 shrink-0 items-center justify-end px-2">
            <button
              type="button"
              aria-label={t('chat.thread.info.close')}
              onClick={onClose}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-45 transition-colors duration-150 hover:bg-ink/[0.08] hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <div
            ref={scrollRef}
            className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-6"
            style={{ isolation: 'isolate' }}
          >
            <Identity />
            <div className="flex flex-col gap-2">
              {hasTimer(conversation) && isActiveMember(conversation) && <TimerPicker />}
              {conversation.kind !== 'self' && isActiveMember(conversation) && <MuteRow />}
              {canManageMembers(conversation) && <InviteRow />}
            </div>
            <div
              role="tablist"
              className="sticky top-0 z-10 mt-4 mb-2 flex gap-1 rounded-2xl p-1"
              style={{ background: surface(9) }}
            >
              <TabButton
                active={tab === 'tracks'}
                onClick={() => setTab('tracks')}
                icon={<ListMusic size={14} />}
                label={t('chat.thread.info.tracks')}
              />
              {showMembers && (
                <TabButton
                  active={tab === 'members'}
                  onClick={() => setTab('members')}
                  icon={<Users size={14} />}
                  label={t('chat.thread.info.membersTab')}
                />
              )}
              {showGallery && (
                <TabButton
                  active={tab === 'gallery'}
                  onClick={() => setTab('gallery')}
                  icon={<Images size={14} />}
                  label={t('chat.media.gallery.tab')}
                />
              )}
            </div>
            {tab === 'tracks' && <TracksTab scrollRef={scrollRef} onJump={onJump} />}
            {tab === 'members' && showMembers && <MembersTab />}
            {tab === 'gallery' && showGallery && (
              <GalleryTab scrollRef={scrollRef} onJump={onJump} />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
});
