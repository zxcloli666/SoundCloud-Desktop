import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../../lib/chat/bridge';
import { chatError } from '../../../../lib/chat/errors';
import { Flag } from '../../../../lib/chat/icons';
import type { MediaId } from '../../../../lib/chat/media-types';
import type { ConvId, ReportReason } from '../../../../lib/chat/types';
import {
  CircleCheck,
  Ellipsis,
  Eye,
  EyeOff,
  Radio,
  ShieldAlert,
  TriangleAlert,
} from '../../../../lib/icons';
import { useBackdropStore } from '../../../../stores/chat/backdrop';
import { ModalTitle } from '../../../ui/Modal';

const REASONS: { reason: ReportReason; Icon: typeof Radio }[] = [
  { reason: 'spam', Icon: Radio },
  { reason: 'harassment', Icon: TriangleAlert },
  { reason: 'doxxing', Icon: Eye },
  { reason: 'illegal', Icon: ShieldAlert },
  { reason: 'other', Icon: Ellipsis },
];

const COMMENT_MAX = 500;

type Phase = 'edit' | 'sending' | 'sent' | 'changed' | 'failed';

function Done({
  phase,
  hidden,
  onHide,
  onClose,
}: {
  phase: 'sent' | 'changed';
  hidden: boolean;
  onHide: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center animate-[backdrop-in_0.3s_var(--ease-apple)_both] backdrop-motion">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-ok/10 text-ok">
        <CircleCheck size={22} />
      </span>
      <ModalTitle>
        {t(phase === 'sent' ? 'chat.backdrop.report.sent' : 'chat.backdrop.report.changed')}
      </ModalTitle>
      <div className="mt-2 flex w-full gap-2">
        {phase === 'sent' && !hidden && (
          <button
            type="button"
            onClick={onHide}
            className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-ink/[0.06] text-[13px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.1]"
          >
            <EyeOff size={14} />
            {t('chat.backdrop.hide')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-ink/[0.1] text-[13px] font-semibold text-ink-90 transition-colors hover:bg-ink/[0.14]"
        >
          {t('chat.backdrop.done')}
        </button>
      </div>
    </div>
  );
}

export const ReportBackdrop = memo(function ReportBackdrop({
  conversationId,
  mediaId,
  hidden,
  onClose,
}: {
  conversationId: ConvId;
  mediaId: MediaId;
  hidden: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hide = useBackdropStore((state) => state.hide);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<Phase>('edit');

  const send = async () => {
    if (!reason) return;
    setPhase('sending');
    try {
      await chatBridge.roomBackdropReport(conversationId, mediaId, reason, comment.trim() || null);
      setPhase('sent');
    } catch (error) {
      setPhase(chatError(error)?.code === 'media_missing' ? 'changed' : 'failed');
    }
  };

  if (phase === 'sent' || phase === 'changed') {
    return (
      <Done
        phase={phase}
        hidden={hidden}
        onHide={() => {
          hide(conversationId, mediaId);
          onClose();
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
          <Flag size={17} />
        </span>
        <ModalTitle>{t('chat.backdrop.report.title')}</ModalTitle>
      </div>
      <div role="radiogroup" className="grid grid-cols-1 gap-1.5">
        {REASONS.map(({ reason: value, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={reason === value}
            onClick={() => setReason(value)}
            className={`flex h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 text-left text-[13px] font-medium transition-colors duration-150 ${
              reason === value
                ? 'border-rose-400/45 bg-rose-500/12 text-ink'
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
        placeholder={t('chat.backdrop.report.comment')}
        rows={2}
        className="resize-none rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-3 py-2 text-[13px] text-ink-85 outline-none placeholder:text-ink-30 focus:border-ink/[0.14]"
      />
      {phase === 'failed' && (
        <p role="alert" className="flex items-center gap-2 text-[12.5px] font-medium text-bad">
          <TriangleAlert size={14} />
          {t('chat.backdrop.report.failed')}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-ink/[0.06] text-[13px] font-semibold text-ink-70 transition-colors duration-150 hover:bg-ink/[0.1]"
        >
          {t('chat.backdrop.cancel')}
        </button>
        <button
          type="button"
          disabled={!reason || phase === 'sending'}
          onClick={() => void send()}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-rose-500/85 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-rose-500 disabled:cursor-default disabled:opacity-40"
        >
          {t(phase === 'failed' ? 'chat.backdrop.retry' : 'chat.backdrop.report.send')}
        </button>
      </div>
    </div>
  );
});
