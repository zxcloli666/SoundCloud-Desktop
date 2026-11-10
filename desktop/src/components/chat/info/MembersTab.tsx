import type { TFunction } from 'i18next';
import { type MouseEvent, memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { UserPlus } from '../../../lib/chat/icons';
import { senderColor } from '../../../lib/chat/render';
import type { ConversationSummary, Member } from '../../../lib/chat/types';
import { Crown, Ellipsis, Shield, ShieldAlert, X } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { type ContextMenuEntry, openContextMenu } from '../../../stores/context-menu';
import { Avatar } from '../../ui/Avatar';
import { useOpenProfile } from '../profile';
import { useThread } from '../thread/context';
import { toastError } from '../thread/errors';
import { canManageMembers } from '../thread/permissions';
import { AddMembersSheet } from './AddMembersSheet';

const NO_MEMBERS: Member[] = [];
const ROLE_ORDER = { owner: 0, admin: 1, member: 2 } as const;

function memberMenu(
  member: Member,
  conversation: ConversationSummary,
  t: TFunction,
  language: string,
): ContextMenuEntry[] {
  const reload = () => useChatThreadStore.getState().loadMembers(conversation.id);
  const fail = (error: unknown) => toastError(error, t, language);
  const entries: ContextMenuEntry[] = [];
  if (conversation.role === 'owner') {
    const admin = member.role === 'admin';
    entries.push({
      id: 'role',
      label: t(admin ? 'chat.thread.info.removeAdmin' : 'chat.thread.info.makeAdmin'),
      icon: admin ? <ShieldAlert size={14} /> : <Shield size={14} />,
      onSelect: () =>
        void chatBridge
          .memberRole(conversation.id, member.user.id, admin ? 'member' : 'admin')
          .then(reload)
          .catch(fail),
    });
  }
  entries.push({
    id: 'remove',
    label: t('chat.thread.info.removeMember'),
    icon: <X size={14} />,
    onSelect: () =>
      void chatBridge.memberRemove(conversation.id, member.user.id).then(reload).catch(fail),
  });
  return entries;
}

function canTouch(member: Member, conversation: ConversationSummary, me: string | null): boolean {
  if (!canManageMembers(conversation) || member.user.id === me || member.role === 'owner') {
    return false;
  }
  return conversation.role === 'owner' || member.role === 'member';
}

export const MemberRow = memo(function MemberRow({
  member,
  menu,
}: {
  member: Member;
  menu: ContextMenuEntry[] | null;
}) {
  const { t } = useTranslation();
  const { me } = useThread();
  const openProfile = useOpenProfile();
  const manage = menu !== null && menu.length > 0;
  const open = (event: MouseEvent) => {
    if (menu) openContextMenu(event, menu);
  };

  return (
    <div
      onContextMenu={manage ? open : undefined}
      className={`group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-ink/[0.04] ${
        member.state === 'invited' ? 'opacity-55' : ''
      }`}
    >
      <button
        type="button"
        aria-label={t('chat.thread.actions.profile')}
        onClick={() => openProfile(member.user.id)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
      >
        <Avatar src={member.user.avatarUrl} size={34} />
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[13px] font-semibold"
            style={{ color: senderColor(member.user.id) }}
          >
            {member.user.name}
          </span>
          {member.user.id === me && (
            <span className="block text-[11px] text-ink-35">{t('chat.thread.info.you')}</span>
          )}
        </span>
      </button>
      {member.role === 'owner' && (
        <Crown
          size={14}
          aria-label={t('chat.thread.info.owner')}
          className="shrink-0 text-amber-300/85"
        />
      )}
      {member.role === 'admin' && (
        <Shield
          size={14}
          aria-label={t('chat.thread.info.admin')}
          className="shrink-0 text-sky-300/85"
        />
      )}
      {manage && (
        <button
          type="button"
          aria-label={t('chat.thread.actions.more')}
          onClick={open}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-40 opacity-0 transition-opacity duration-150 hover:bg-ink/[0.08] hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Ellipsis size={14} />
        </button>
      )}
    </div>
  );
});

function AddMembersRow({ members }: { members: Member[] }) {
  const { t } = useTranslation();
  const { conversation } = useThread();
  const [open, setOpen] = useState(false);
  const present = useMemo(
    () =>
      new Set(
        members
          .filter((member) => member.state === 'active' || member.state === 'invited')
          .map((member) => member.user.id),
      ),
    [members],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-1 flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 hover:bg-ink/[0.04]"
      >
        <span
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
        >
          <UserPlus size={15} />
        </span>
        <span className="text-[13px] font-semibold text-ink-85">
          {t('chat.thread.info.addMembers')}
        </span>
      </button>
      <AddMembersSheet
        open={open}
        conversationId={conversation.id}
        present={present}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export const MembersTab = memo(function MembersTab() {
  const { t, i18n } = useTranslation();
  const { conversation, me } = useThread();
  const members = useChatThreadStore(
    (state) => state.threads[conversation.id]?.members ?? NO_MEMBERS,
  );

  useEffect(() => {
    void useChatThreadStore.getState().loadMembers(conversation.id);
  }, [conversation.id]);

  const sorted = [...members]
    .filter((member) => member.state === 'active' || member.state === 'invited')
    .sort(
      (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.user.name.localeCompare(b.user.name),
    );

  return (
    <div className="flex flex-col gap-0.5">
      {canManageMembers(conversation) && <AddMembersRow members={members} />}
      {sorted.map((member) => (
        <MemberRow
          key={member.user.id}
          member={member}
          menu={
            canTouch(member, conversation, me)
              ? memberMenu(member, conversation, t, i18n.language)
              : null
          }
        />
      ))}
    </div>
  );
});
