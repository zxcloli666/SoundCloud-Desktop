import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationSummary, UserRef } from '../../../lib/chat/types';
import { Bookmark, Search } from '../../../lib/icons';
import { useChatStore } from '../../../stores/chat';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { listErrorKey } from '../shell/errors';
import { useOpenChat } from '../shell/useOpenChat';
import { useNewChatStore } from './new-chat-store';
import { PeoplePicker } from './PeoplePicker';
import { PickedChips } from './PickedChips';
import { createChat, createDirectChat, createSavedChat } from './start-chat';

const GROUP_MEMBERS_DEFAULT = 200;
const TITLE_MAX = 64;

function NewChatBody({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const openChat = useOpenChat();
  const membersMax = useChatStore(
    (state) => state.config?.limits.groupMembersMax ?? GROUP_MEMBERS_DEFAULT,
  );
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<UserRef[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const group = picked.length > 1;

  const toggle = (person: UserRef) =>
    setPicked((list) =>
      list.some((item) => item.id === person.id)
        ? list.filter((item) => item.id !== person.id)
        : [...list, person],
    );

  const run = async (make: () => Promise<ConversationSummary>) => {
    setBusy(true);
    setError(null);
    try {
      const summary = await make();
      onDone();
      openChat(summary.id);
    } catch (failure) {
      setError(t(listErrorKey(failure)));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    group
      ? run(() =>
          createChat({
            kind: 'group',
            members: picked.map((person) => person.id),
            title: title.trim() || null,
          }),
        )
      : run(() => createDirectChat(picked[0].id));

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-3 px-6 pt-6 pb-3">
        <ModalTitle>{t('chat.list.new.title')}</ModalTitle>
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
        {group && (
          <input
            value={title}
            maxLength={TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('chat.list.new.groupName')}
            className="h-10 rounded-2xl border border-ink/[0.07] bg-black/20 px-3.5 text-[13.5px] text-ink-90 outline-none placeholder:text-ink-30 focus:border-ink/[0.16]"
          />
        )}
      </div>
      <div className="min-h-[200px] flex-1 overflow-y-auto px-3.5 pb-2">
        {picked.length === 0 && !query && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(createSavedChat)}
            className="mb-2 flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors duration-200 hover:bg-ink/[0.05]"
          >
            <span
              className="flex size-[38px] shrink-0 items-center justify-center rounded-full"
              style={{
                color: 'var(--color-accent-contrast)',
                background:
                  'linear-gradient(145deg, var(--color-accent-hover), var(--color-accent))',
              }}
            >
              <Bookmark size={16} strokeWidth={2.2} />
            </span>
            <span className="text-[13.5px] font-semibold text-ink-85">{t('chat.list.saved')}</span>
          </button>
        )}
        <PeoplePicker
          query={query}
          picked={picked}
          full={picked.length >= membersMax - 1}
          onToggle={toggle}
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-ink/[0.05] px-6 pt-3 pb-5">
        {error && <p className="text-[12px] text-rose-300/90">{error}</p>}
        <button
          type="button"
          disabled={picked.length === 0 || busy}
          onClick={() => void start()}
          className="h-11 w-full cursor-pointer rounded-2xl text-[13.5px] font-bold transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100"
          style={{
            color: 'var(--color-accent-contrast)',
            background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
            boxShadow: '0 10px 28px var(--color-accent-glow)',
          }}
        >
          {group ? t('chat.list.new.createGroup', { n: picked.length }) : t('chat.list.new.write')}
        </button>
      </div>
    </div>
  );
}

export const NewChatSheet = memo(function NewChatSheet() {
  const open = useNewChatStore((state) => state.open);
  const session = useNewChatStore((state) => state.session);
  const close = useNewChatStore((state) => state.close);
  return (
    <Modal open={open} onOpenChange={(next) => !next && close()}>
      <ModalContent size="md">
        <NewChatBody key={session} onDone={close} />
      </ModalContent>
    </Modal>
  );
});
