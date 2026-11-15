import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MethodId } from '../../../lib/pay-client';
import { MethodGlyph } from '../MethodGlyph';
import { PillBtn } from './StarConsole';

export const LinkRow = memo(function LinkRow({
  method,
  onLink,
}: {
  method: MethodId;
  onLink: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ink/[0.08] bg-ink/[0.03] px-4 py-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-ink/[0.08] bg-ink/[0.04]">
          <MethodGlyph kind={method} linked />
        </span>
        <span className="block text-[13px] font-medium text-ink-85">
          {t(`starpass.bind.${method}.link`)}
        </span>
      </span>
      <PillBtn tone="accent" onClick={onLink}>
        {t('starpass.bind.link')}
      </PillBtn>
    </div>
  );
});
