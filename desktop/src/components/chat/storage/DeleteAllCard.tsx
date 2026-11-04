import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from '../../../lib/icons';
import { DeleteAllDialog } from './DeleteAllDialog';
import { Panel } from './Panel';

export const DeleteAllCard = memo(function DeleteAllCard({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Panel ui="chat-storage-danger" tone="danger" className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-ink-85">
            {t('chat.storage.deleteAll.title')}
          </span>
          <span className="text-[11.5px] leading-snug text-ink-45">
            {t('chat.storage.deleteAll.hint')}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12px] font-semibold text-bad outline-none transition-colors hover:bg-bad/[0.16] focus-visible:ring-2 focus-visible:ring-bad/50 disabled:cursor-default disabled:opacity-40"
        >
          <Trash2 size={13} />
          {t('chat.storage.deleteAll.action')}
        </button>
      </div>
      <DeleteAllDialog open={open} onClose={() => setOpen(false)} />
    </Panel>
  );
});
