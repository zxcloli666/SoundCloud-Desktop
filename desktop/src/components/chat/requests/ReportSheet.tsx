import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { Flag } from '../../../lib/chat/icons';
import type { ReportReason } from '../../../lib/chat/types';
import { Check } from '../../../lib/icons';
import { Toggle } from '../../settings/primitives';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { PolicyLadder, PrivacyNote } from '../settings/ModerationPolicy';
import { listErrorKey } from '../shell/errors';
import { ReportReasons } from './ReportReasons';
import { type ReportTarget, useReportStore } from './report-store';

const COMMENT_MAX = 500;
const CLOSE_AFTER_MS = 1400;

type Phase = 'idle' | 'sending' | 'sent';

function ReportSent() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
        <Check size={22} strokeWidth={2.6} />
      </div>
      <ModalTitle>{t('chat.list.report.sent')}</ModalTitle>
    </div>
  );
}

function ReportBody({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'sent') return;
    const timer = setTimeout(onClose, CLOSE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [phase, onClose]);

  const send = async () => {
    if (!reason) return;
    setPhase('sending');
    setError(null);
    try {
      await chatBridge.report({
        conversationId: target.conversationId,
        seqFrom: target.seqFrom,
        seqTo: target.seqTo,
        reason,
        comment: comment.trim() || null,
      });
      if (alsoBlock && target.userId) await chatBridge.block(target.userId);
      setPhase('sent');
    } catch (failure) {
      setError(t(listErrorKey(failure)));
      setPhase('idle');
    }
  };

  if (phase === 'sent') return <ReportSent />;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
          <Flag size={17} />
        </div>
        <ModalTitle>{t('chat.list.report.title', { name: target.name })}</ModalTitle>
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-2">
        <ReportReasons value={reason} onChange={setReason} />
        <textarea
          value={comment}
          maxLength={COMMENT_MAX}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t('chat.list.report.comment')}
          rows={2}
          className="w-full resize-none rounded-2xl border border-ink/[0.07] bg-black/20 px-3.5 py-2.5 text-[13px] text-ink-85 outline-none placeholder:text-ink-30 focus:border-ink/[0.16]"
        />
        {target.userId && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink/[0.03] px-3.5 py-2.5">
            <span className="text-[12.5px] font-medium text-ink-75">
              {t('chat.list.report.alsoBlock')}
            </span>
            <Toggle
              checked={alsoBlock}
              onChange={() => setAlsoBlock(!alsoBlock)}
              label={t('chat.list.report.alsoBlock')}
            />
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-2xl border border-ink/[0.05] bg-ink/[0.02] px-3.5 py-3">
          <PolicyLadder />
          <div className="h-px bg-ink/[0.05]" />
          <PrivacyNote />
        </div>
      </div>
      {error && <p className="px-6 pt-2 text-[12px] text-rose-300/90">{error}</p>}
      <div className="flex gap-2 px-6 pt-4 pb-6">
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-ink/[0.06] text-[13px] font-semibold text-ink-70 transition-colors hover:bg-ink/[0.1]"
        >
          {t('chat.list.cancel')}
        </button>
        <button
          type="button"
          disabled={!reason || phase === 'sending'}
          onClick={() => void send()}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-rose-500/85 text-[13px] font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-default disabled:opacity-40"
        >
          {t('chat.list.report.send')}
        </button>
      </div>
    </div>
  );
}

export const ReportSheet = memo(function ReportSheet() {
  const open = useReportStore((state) => state.open);
  const session = useReportStore((state) => state.session);
  const target = useReportStore((state) => state.target);
  const close = useReportStore((state) => state.close);
  return (
    <Modal open={open} onOpenChange={(next) => !next && close()}>
      <ModalContent size="md">
        {target && <ReportBody key={session} target={target} onClose={close} />}
      </ModalContent>
    </Modal>
  );
});
