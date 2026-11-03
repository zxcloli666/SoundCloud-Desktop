import { openUrl } from '@tauri-apps/plugin-opener';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvId } from '../../../lib/chat/types';
import { ExternalLink } from '../../../lib/icons';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { ReactionPicker } from '../bubbles/ReactionPicker';
import { DeleteDialog } from './DeleteDialog';
import { useThreadDialogs } from './dialogs';
import { ForwardDialog } from './ForwardDialog';
import { ReportDialog } from './ReportDialog';

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function LinkDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-7 pb-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-ink/[0.08] bg-ink/[0.05] text-ink-70">
        <ExternalLink size={20} />
      </div>
      <ModalTitle>{t('chat.thread.link.title')}</ModalTitle>
      <div className="w-full rounded-xl bg-ink/[0.04] px-3 py-2.5 text-left">
        <div className="text-[14px] font-semibold text-ink-90">{hostOf(url)}</div>
        <div className="mt-0.5 break-all text-[11.5px] text-ink-40">{url}</div>
      </div>
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 cursor-pointer rounded-xl bg-ink/[0.06] text-[13px] font-semibold text-ink-70 transition-colors duration-150 hover:bg-ink/[0.1]"
        >
          {t('chat.thread.cancel')}
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            void openUrl(url).catch(() => undefined);
          }}
          className="h-10 flex-1 cursor-pointer rounded-xl text-[13px] font-bold transition-transform duration-150 hover:scale-[1.02]"
          style={{ background: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
        >
          {t('chat.thread.link.open')}
        </button>
      </div>
    </div>
  );
}

export const ThreadDialogs = memo(function ThreadDialogs({
  conversationId,
}: {
  conversationId: ConvId;
}) {
  const dialog = useThreadDialogs((state) =>
    state.dialog?.conversationId === conversationId ? state.dialog : null,
  );
  const close = useThreadDialogs((state) => state.close);
  const shown = useRef(dialog);
  if (dialog) shown.current = dialog;
  const view = shown.current;

  return (
    <>
      <ReactionPicker conversationId={conversationId} />
      <Modal open={dialog !== null} onOpenChange={(open) => !open && close()}>
        <ModalContent size="sm" showClose={false}>
          {view?.kind === 'delete' && <DeleteDialog message={view.message} onClose={close} />}
          {view?.kind === 'report' && <ReportDialog message={view.message} onClose={close} />}
          {view?.kind === 'link' && <LinkDialog url={view.url} onClose={close} />}
          {view?.kind === 'forward' && <ForwardDialog message={view.message} onClose={close} />}
        </ModalContent>
      </Modal>
    </>
  );
});
