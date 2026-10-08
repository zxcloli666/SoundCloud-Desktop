import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShownVerdict } from '../../lib/net/check';
import { currentOs, HEALTH_HOST, manualSteps, showManual } from '../../lib/net/manual';
import { CopyLine } from './CopyLine';

export const ManualSteps = React.memo(() => {
  const { t } = useTranslation();
  const verdict = useShownVerdict();
  if (!showManual(verdict)) return null;
  const os = currentOs();
  return (
    <div className="mt-5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35">
        {t('netCheck.manual.title')}
      </div>
      <p className="text-[11.5px] text-white/35 mt-0.5 mb-2">
        {t(os === 'windows' ? 'netCheck.manual.windows' : 'netCheck.manual.unix')}
      </p>
      <div className="space-y-1.5">
        {manualSteps(os).map((step, index) => (
          <CopyLine
            key={step.text}
            step={index + 1}
            text={step.text}
            action={step.action}
            label={
              step.action === 'open'
                ? t('netCheck.manual.browser', { host: HEALTH_HOST })
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
});
