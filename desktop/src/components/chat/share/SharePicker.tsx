import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { sendEmbed } from '../../../lib/chat/share';
import type { ConversationSummary, ConvId, Embed } from '../../../lib/chat/types';
import { Loader2, Search, Send } from '../../../lib/icons';
import { roomLinkBlock } from '../../../lib/together/room-chat';
import { linkBlockKey } from '../../../lib/together/room-rules';
import { useChatStore } from '../../../stores/chat';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { EmbedCard } from '../embeds/EmbedCard';
import { ShareGrid } from './ShareGrid';
import { targetTitle } from './share-target';
import { useShareTargets } from './useShareTargets';

const TEXT_MAX_FALLBACK = 4096;

export interface SharePickerProps {
  open: boolean;
  embed: Embed | null;
  onClose: () => void;
  onSent?: (conversationIds: ConvId[]) => void;
}

function embedKey(embed: Embed): string {
  return [embed.kind, embed.urn, embed.room?.code ?? '', embed.atMs ?? ''].join(':');
}

interface PickerBodyProps {
  embed: Embed;
  onClose: () => void;
  onSent?: (conversationIds: ConvId[]) => void;
}

function PickerBody({ embed, onClose, onSent }: PickerBodyProps) {
  const { t } = useTranslation();
  const textMax = useChatStore((s) => s.config?.limits.textMax ?? TEXT_MAX_FALLBACK);
  const [search, setSearch] = useState('');
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState<ConvId[]>([]);
  const [sending, setSending] = useState(false);
  const titleOf = useCallback((c: ConversationSummary) => targetTitle(t, c), [t]);
  const targets = useShareTargets(search, titleOf);

  const toggle = useCallback(
    (id: ConvId) =>
      setSelected((previous) =>
        previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
      ),
    [],
  );

  const send = async () => {
    if (selected.length === 0 || sending) return;
    const block = selected.map((id) => roomLinkBlock(id, comment)).find(Boolean);
    if (block) {
      toast.error(t(linkBlockKey(block)));
      return;
    }
    setSending(true);
    const result = await sendEmbed(selected, embed, comment);
    setSending(false);
    if (result.sent.length > 0) {
      toast.success(t('chat.embeds.share.sent', { count: result.sent.length }));
      onSent?.(result.sent);
    }
    if (result.failed.length > 0) {
      toast.error(t('chat.embeds.share.failed', { count: result.failed.length }));
      setSelected(result.failed);
      return;
    }
    onClose();
  };

  return (
    <div data-ui="chat-share" className="flex min-h-0 flex-col">
      <div className="px-6 pt-6 pb-3">
        <ModalTitle>{t('chat.embeds.share.title')}</ModalTitle>
      </div>
      <div className="px-6 pb-3">
        <EmbedCard embed={embed} compact />
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
      <div className="flex items-center gap-2 border-t border-ink/[0.06] px-6 py-4">
        <input
          value={comment}
          maxLength={textMax}
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={t('chat.embeds.share.comment')}
          className="h-10 min-w-0 flex-1 rounded-xl bg-ink/[0.05] px-3 text-[13px] text-ink-90 outline-none placeholder:text-ink-30 focus:bg-ink/[0.07]"
        />
        <button
          type="button"
          disabled={selected.length === 0 || sending}
          onClick={() => void send()}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-accent-contrast transition-all duration-300 cursor-pointer hover:brightness-110 active:scale-[0.97] disabled:cursor-default disabled:opacity-40"
          style={{
            boxShadow: selected.length > 0 ? '0 8px 24px var(--color-accent-glow)' : undefined,
          }}
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {selected.length > 0
            ? t('chat.embeds.share.sendCount', { count: selected.length })
            : t('chat.embeds.share.send')}
        </button>
      </div>
    </div>
  );
}

export const SharePicker = memo(function SharePicker({
  open,
  embed,
  onClose,
  onSent,
}: SharePickerProps) {
  return (
    <Modal open={open && embed !== null} onOpenChange={(next) => !next && onClose()}>
      <ModalContent size="sm">
        {embed && (
          <PickerBody key={embedKey(embed)} embed={embed} onClose={onClose} onSent={onSent} />
        )}
      </ModalContent>
    </Modal>
  );
});
