import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import type { ConvId, UserId, UserRef } from '../../../lib/chat/types';
import { Search } from '../../../lib/icons';
import { useChatStore } from '../../../stores/chat';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { PeoplePicker } from '../new-chat/PeoplePicker';
import { PickedChips } from '../new-chat/PickedChips';
import { errorText } from '../thread/errors';

const GROUP_MEMBERS_DEFAULT = 200;

interface AddMembersProps {
  conversationId: ConvId;
  present: ReadonlySet<UserId>;
  onDone: () => void;
}

function AddMembersBody({ conversationId, present, onDone }: AddMembersProps) {
  const { t, i18n } = useTranslation();
  const membersMax = useChatStore(
    (state) => state.config?.limits.groupMembersMax ?? GROUP_MEMBERS_DEFAULT,
  );
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<UserRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const free = Math.max(0, membersMax - present.size);

  const toggle = (person: UserRef) =>
    setPicked((list) =>
      list.some((item) => item.id === person.id)
        ? list.filter((item) => item.id !== person.id)
        : [...list, person],
    );

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await chatBridge.memberAdd(
        conversationId,
        picked.map((person) => person.id),
      );
      await useChatThreadStore.getState().loadMembers(conversationId);
      onDone();
    } catch (failure) {
      setError(errorText(failure, t, i18n.language));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-3 px-6 pt-6 pb-3">
        <ModalTitle>{t('chat.thread.info.addMembers')}</ModalTitle>
        <label className="flex h-10 items-center gap-2.5 rounded-2xl border border-ink/[0.07] bg-black/20 px-3.5 focus-within:border-ink/[0.16]">
          <Search size={15} className="shrink-0 text-ink-35" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('chat.list.new.search')}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink-90 outline-none placeholder:text-ink-30"
          />
        </label>
        <PickedChips people={picked} onRemove={toggle} />
      </div>
      <div className="min-h-[200px] flex-1 overflow-y-auto px-3.5 pb-2">
        <PeoplePicker
          query={query}
          picked={picked}
          full={picked.length >= free}
          exclude={present}
          onToggle={toggle}
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-ink/[0.05] px-6 pt-3 pb-5">
        {error && <p className="text-[12px] text-rose-300/90">{error}</p>}
        <button
          type="button"
          disabled={picked.length === 0 || busy}
          onClick={() => void add()}
          className="h-11 w-full cursor-pointer rounded-2xl text-[13.5px] font-bold transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100"
          style={{
            color: 'var(--color-accent-contrast)',
            background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
            boxShadow: '0 10px 28px var(--color-accent-glow)',
          }}
        >
          {picked.length > 0
            ? t('chat.thread.info.addPicked', { n: picked.length })
            : t('chat.thread.info.add')}
        </button>
      </div>
    </div>
  );
}

export const AddMembersSheet = memo(function AddMembersSheet({
  open,
  onClose,
  ...body
}: Omit<AddMembersProps, 'onDone'> & { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onOpenChange={(next) => !next && onClose()}>
      <ModalContent size="md">{open && <AddMembersBody {...body} onDone={onClose} />}</ModalContent>
    </Modal>
  );
});
