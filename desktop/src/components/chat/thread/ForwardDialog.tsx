import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { chatBridge } from '../../../lib/chat/bridge';
import { Reply } from '../../../lib/chat/icons';
import type { ConversationSummary, ConvId, Message, MessageRef } from '../../../lib/chat/types';
import { Loader2, Search } from '../../../lib/icons';
import { ModalTitle } from '../../ui/Modal';
import { ShareGrid } from '../share/ShareGrid';
import { targetTitle } from '../share/share-target';
import { useShareTargets } from '../share/useShareTargets';

const SEND_PARALLEL = 4;
const NO_TEXT = { text: '', spans: [] };

async function forwardTo(targets: ConvId[], forward: MessageRef): Promise<ConvId[]> {
  const failed: ConvId[] = [];
  for (let start = 0; start < targets.length; start += SEND_PARALLEL) {
    const part = targets.slice(start, start + SEND_PARALLEL);
    const settled = await Promise.allSettled(
      part.map((conversationId) =>
        chatBridge.send({ conversationId, text: NO_TEXT, embeds: [], forward }),
      ),
    );
    settled.forEach((result, i) => {
      if (result.status === 'rejected') failed.push(part[i]);
    });
  }
  return failed;
}

export const ForwardDialog = memo(function ForwardDialog({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ConvId[]>([]);
  const [sending, setSending] = useState(false);
  const titleOf = useCallback((c: ConversationSummary) => targetTitle(t, c), [t]);
  const all = useShareTargets(search, titleOf);
  const targets = useMemo(
    () => ({ ...all, items: all.items.filter((conversation) => conversation.kind !== 'room') }),
    [all],
  );

  const toggle = useCallback(
    (id: ConvId) =>
      setSelected((list) =>
        list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
      ),
    [],
  );

  const send = async () => {
    if (selected.length === 0 || sending || message.seq === null) return;
    setSending(true);
    const failed = await forwardTo(selected, {
      conversationId: message.conversationId,
      seq: message.seq,
    });
    setSending(false);
    const sent = selected.length - failed.length;
    if (sent > 0) toast.success(t('chat.embeds.share.sent', { count: sent }));
    if (failed.length > 0) {
      toast.error(t('chat.embeds.share.failed', { count: failed.length }));
      setSelected(failed);
      return;
    }
    onClose();
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-3 px-6 pt-6 pb-3">
        <Reply size={17} className="shrink-0 -scale-x-100 text-ink-60" />
        <ModalTitle>{t('chat.thread.actions.forward')}</ModalTitle>
      </div>
      <label className="mx-6 mb-2 flex h-9 items-center gap-2 rounded-xl bg-ink/[0.05] px-3 text-ink-40 focus-within:bg-ink/[0.07] focus-within:text-ink-70">
        <Search size={14} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('chat.embeds.share.search')}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-90 outline-none placeholder:text-ink-30"
        />
      </label>
      <ShareGrid
        targets={targets}
        selected={selected}
        titleOf={titleOf}
        onToggle={toggle}
        searching={search.trim().length > 0}
      />
      <div className="flex gap-2 border-t border-ink/[0.06] px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-ink/[0.06] text-[13px] font-semibold text-ink-70 transition-colors duration-150 hover:bg-ink/[0.1]"
        >
          {t('chat.thread.cancel')}
        </button>
        <button
          type="button"
          disabled={selected.length === 0 || sending}
          onClick={() => void send()}
          className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-[filter,opacity] duration-150 hover:brightness-110 disabled:cursor-default disabled:opacity-40"
          style={{ background: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
        >
          {sending && <Loader2 size={14} className="animate-spin" />}
          {selected.length > 0
            ? t('chat.embeds.share.sendCount', { count: selected.length })
            : t('chat.embeds.share.send')}
        </button>
      </div>
    </div>
  );
});
