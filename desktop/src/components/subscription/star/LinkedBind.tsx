import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoostyMethod } from '../../../lib/pay-client';
import { ProviderGlyph } from '../ProviderGlyph';
import { LinkBtn } from './StarConsole';

export const LinkedBind = memo(function LinkedBind({
  method,
  removing,
  onRemove,
}: {
  method: BoostyMethod;
  removing: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-4 py-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-ink/[0.08] bg-ink/[0.04]">
          <ProviderGlyph kind={method === 'sbp' ? 'sbp' : 'boosty_card'} />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-ink-85">
            {t(`starpass.bind.${method}.linked`)}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-ink-40">
            {t(
              asking && method === 'sbp'
                ? 'starpass.bind.sbp.cancelInBank'
                : 'starpass.bind.linkedSub',
            )}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {asking && !removing && (
          <LinkBtn onClick={() => setAsking(false)}>{t('starpass.bind.keep')}</LinkBtn>
        )}
        <button
          type="button"
          disabled={removing}
          onClick={() => (asking ? onRemove() : setAsking(true))}
          className={`cursor-pointer rounded-[10px] border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors disabled:cursor-default disabled:opacity-50 ${asking ? 'border-bad/50 text-bad' : 'border-ink/[0.12] text-ink-50 hover:text-ink-90'}`}
        >
          {asking ? t(`starpass.bind.${method}.removeYes`) : t('starpass.bind.remove')}
        </button>
      </span>
    </div>
  );
});
