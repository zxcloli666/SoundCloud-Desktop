import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BindFlow, MethodId } from '../../../lib/pay-client';
import { MethodGlyph } from '../MethodGlyph';
import { LinkBtn, PillBtn } from './StarConsole';

export const LinkedBind = memo(function LinkedBind({
  method,
  flow,
  rebind = false,
  used = true,
  removing,
  onRemove,
  onRelink,
}: {
  method: MethodId;
  flow: BindFlow;
  rebind?: boolean;
  used?: boolean;
  removing: boolean;
  onRemove: () => void;
  onRelink?: () => void;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const noteKey =
    asking && flow === 'qr'
      ? 'starpass.bind.sbp.cancelInBank'
      : rebind
        ? 'starpass.bind.rebind'
        : used
          ? 'starpass.bind.linkedSub'
          : 'starpass.bind.linkedIdle';
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3 ${rebind ? 'border-bad/40 bg-bad/[0.05]' : 'border-ink/[0.08] bg-ink/[0.03]'}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-ink/[0.08] bg-ink/[0.04]">
          <MethodGlyph kind={method} linked />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-ink-85">
            {t(`starpass.bind.${method}.linked`)}
          </span>
          <span
            className={`mt-0.5 block text-[11.5px] ${rebind && !asking ? 'text-bad' : 'text-ink-40'}`}
          >
            {t(noteKey)}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {asking && !removing && (
          <LinkBtn onClick={() => setAsking(false)}>{t('starpass.bind.keep')}</LinkBtn>
        )}
        {rebind && onRelink && !asking && (
          <PillBtn tone="accent" onClick={onRelink}>
            {t('starpass.bind.relink')}
          </PillBtn>
        )}
        <PillBtn
          tone={asking ? 'bad' : 'quiet'}
          disabled={removing}
          onClick={() => (asking ? onRemove() : setAsking(true))}
        >
          {asking ? t(`starpass.bind.${method}.removeYes`) : t('starpass.bind.remove')}
        </PillBtn>
      </span>
    </div>
  );
});
