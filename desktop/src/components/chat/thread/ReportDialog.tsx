import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { chatBridge } from '../../../lib/chat/bridge';
import { Flag } from '../../../lib/chat/icons';
import type { Message, ReportReason } from '../../../lib/chat/types';
import { Ellipsis, Eye, Radio, ShieldAlert, TriangleAlert } from '../../../lib/icons';
import { ModalTitle } from '../../ui/Modal';
import { toastError } from './errors';

const REASONS: { reason: ReportReason; Icon: typeof Radio }[] = [
  { reason: 'spam', Icon: Radio },
  { reason: 'harassment', Icon: TriangleAlert },
  { reason: 'doxxing', Icon: Eye },
  { reason: 'illegal', Icon: ShieldAlert },
  { reason: 'other', Icon: Ellipsis },
];

const COMMENT_MAX = 500;

export const ReportDialog = memo(function ReportDialog({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason || message.seq === null) return;
    setBusy(true);
    try {
      await chatBridge.report({
        conversationId: message.conversationId,
        seqFrom: message.seq,
        seqTo: message.seq,
        reason,
        comment: comment.trim() || null,
      });
      toast.success(t('chat.thread.report.sent'));
      onClose();
    } catch (error) {
      toastError(error, t, i18n.language);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
          <Flag size={17} />
        </span>
        <ModalTitle>{t('chat.thread.report.title')}</ModalTitle>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {REASONS.map(({ reason: value, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={reason === value}
            onClick={() => setReason(value)}
            className={`flex h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 text-left text-[13px] font-medium transition-colors duration-150 ${
              reason === value
                ? 'border-rose-400/45 bg-rose-500/12 text-white'
                : 'border-ink/[0.06] bg-ink/[0.03] text-ink-70 hover:bg-ink/[0.06]'
            }`}
          >
            <Icon size={15} className={reason === value ? 'text-rose-300' : 'text-ink-40'} />
            {t(`chat.thread.report.reasons.${value}`)}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        maxLength={COMMENT_MAX}
        onChange={(event) => setComment(event.target.value)}
        placeholder={t('chat.thread.report.comment')}
        rows={2}
        className="resize-none rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2 text-[13px] text-ink-85 outline-none placeholder:text-ink-30 focus:border-ink/[0.14]"
      />
      <div className="flex flex-col gap-1.5 text-[11.5px] leading-snug text-ink-40">
        <p>{t('chat.thread.report.policy')}</p>
        <p>{t('chat.thread.report.privacy')}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-ink/[0.06] text-[13px] font-semibold text-ink-70 transition-colors duration-150 hover:bg-ink/[0.1]"
        >
          {t('chat.thread.cancel')}
        </button>
        <button
          type="button"
          disabled={!reason || busy}
          onClick={() => void send()}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-rose-500/85 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-rose-500 disabled:cursor-default disabled:opacity-40"
        >
          {t('chat.thread.report.send')}
        </button>
      </div>
    </div>
  );
});
