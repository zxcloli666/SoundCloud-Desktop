import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member, UserRef } from '../../../lib/chat/types';
import { Shield } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import type { ContextMenuEntry } from '../../../stores/context-menu';
import { AddMembersSheet } from '../info/AddMembersSheet';
import { MemberRow } from '../info/MembersTab';
import { ShieldMinus, ShieldPlus } from '../room/icons';
import { useThread } from '../thread/context';
import { setModerator } from './actions';

const NO_MEMBERS: Member[] = [];
const ROLE_ORDER = { owner: 0, admin: 1, member: 2 } as const;

function AddModeratorRow({ staff }: { staff: Member[] }) {
  const { t } = useTranslation();
  const { conversation } = useThread();
  const [open, setOpen] = useState(false);
  const present = useMemo(() => new Set(staff.map((member) => member.user.id)), [staff]);
  const submit = async (people: UserRef[]) => {
    for (const person of people) {
      if (!(await setModerator(conversation.id, person, true))) throw new Error('moderator');
    }
  };

  return (
    <>
      <button
        type="button"
        data-ui="chat-public-add-moderator"
        onClick={() => setOpen(true)}
        className="mb-1 flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 hover:bg-ink/[0.04]"
      >
        <span
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
        >
          <ShieldPlus size={15} />
        </span>
        <span className="text-[13px] font-semibold text-ink-85">{t('chat.public.staff.add')}</span>
      </button>
      <AddMembersSheet
        open={open}
        conversationId={conversation.id}
        present={present}
        title={t('chat.public.staff.add')}
        limit={1}
        submit={submit}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function StaffEmpty() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl border border-ink/[0.07] bg-ink/[0.04] text-ink-40">
        <Shield size={18} />
      </span>
      <span className="text-[12.5px] text-ink-45">{t('chat.public.staff.empty')}</span>
    </div>
  );
}

export const StaffTab = memo(function StaffTab() {
  const { t } = useTranslation();
  const { conversation } = useThread();
  const members = useChatThreadStore(
    (state) => state.threads[conversation.id]?.members ?? NO_MEMBERS,
  );
  const owner = conversation.role === 'owner';

  useEffect(() => {
    void useChatThreadStore.getState().loadMembers(conversation.id);
  }, [conversation.id]);

  const staff = [...members]
    .filter((member) => member.state === 'active' && member.role !== 'member')
    .sort(
      (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.user.name.localeCompare(b.user.name),
    );
  const menuFor = (member: Member): ContextMenuEntry[] | null =>
    owner && member.role === 'admin'
      ? [
          {
            id: 'drop',
            label: t('chat.public.menu.dropModerator'),
            icon: <ShieldMinus size={14} />,
            onSelect: () => void setModerator(conversation.id, member.user, false),
          },
        ]
      : null;

  return (
    <div data-ui="chat-public-staff" className="flex flex-col gap-0.5">
      {owner && <AddModeratorRow staff={staff} />}
      {staff.length === 0 && <StaffEmpty />}
      {staff.map((member) => (
        <MemberRow key={member.user.id} member={member} menu={menuFor(member)} />
      ))}
    </div>
  );
});
