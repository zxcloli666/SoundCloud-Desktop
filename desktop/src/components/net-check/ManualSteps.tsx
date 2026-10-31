import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNetCheckStore, useShownVerdict } from '../../lib/net/check';
import { currentOs, manualSteps, showManual } from '../../lib/net/manual';
import { CopyLine } from './CopyLine';

export const ManualSteps = React.memo(() => {
  const { t } = useTranslation();
  const verdict = useShownVerdict();
  const host = useNetCheckStore((s) => s.report?.targets.find((t) => t.id === 'main')?.host);
  if (!host || !showManual(verdict)) return null;
  const os = currentOs();
  return (
    <div className="mt-5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-35">
        {t('netCheck.manual.title')}
      </div>
      <p className="text-[11.5px] text-ink-35 mt-0.5 mb-2">
        {t(os === 'windows' ? 'netCheck.manual.windows' : 'netCheck.manual.unix')}
      </p>
      <div className="space-y-1.5">
        {manualSteps(os, host).map((step, index) => (
          <CopyLine
            key={step.text}
            step={index + 1}
            text={step.text}
            action={step.action}
            label={step.action === 'open' ? t('netCheck.manual.browser', { host }) : undefined}
          />
        ))}
      </div>
    </div>
  );
});
