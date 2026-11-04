import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvId } from '../../../../lib/chat/types';
import { TriangleAlert, X } from '../../../../lib/icons';
import { type Skipped, useChatMediaStore } from '../../../../stores/chat/media';
import { failureOf } from './failure';
import { RISE } from './motion';

const NONE: Skipped[] = [];
const SHOWN = 4;

export const SkippedNote = memo(function SkippedNote({
  conversationId,
}: {
  conversationId: ConvId;
}) {
  const { t } = useTranslation();
  const skipped = useChatMediaStore((state) => state.skipped[conversationId] ?? NONE);
  if (skipped.length === 0) return null;
  const reason = (skip: Skipped) =>
    skip.reason === 'failed'
      ? failureOf(skip.error, t).text
      : t(`chat.media.skipped.${skip.reason}`);
  const dismiss = () => useChatMediaStore.getState().setSkipped(conversationId, NONE);

  return (
    <div
      role="status"
      data-ui="chat-skipped"
      className={`mx-1 mb-1.5 flex items-start gap-2 rounded-[14px] border px-3 py-2 ${RISE}`}
      style={{ borderColor: 'rgb(var(--bad) / 0.28)', background: 'rgb(var(--bad) / 0.06)' }}
    >
      <TriangleAlert size={14} className="mt-px shrink-0 text-bad" />
      <div className="min-w-0 flex-1 text-[11.5px] leading-snug">
        <div className="font-semibold text-ink-85">
          {t('chat.media.skipped.title', { count: skipped.length })}
        </div>
        <ul className="mt-0.5 text-ink-55">
          {skipped.slice(0, SHOWN).map((skip, index) => (
            <li key={`${skip.name}-${index}`} className="flex min-w-0 gap-1">
              <span className="truncate font-medium text-ink-70">{skip.name}</span>
              <span className="shrink-0">· {reason(skip)}</span>
            </li>
          ))}
          {skipped.length > SHOWN && <li>+{skipped.length - SHOWN}</li>}
        </ul>
      </div>
      <button
        type="button"
        aria-label={t('chat.media.skipped.dismiss')}
        onClick={dismiss}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-40 transition-colors duration-150 hover:bg-ink/[0.07] hover:text-ink-80"
      >
        <X size={12} />
      </button>
    </div>
  );
});
