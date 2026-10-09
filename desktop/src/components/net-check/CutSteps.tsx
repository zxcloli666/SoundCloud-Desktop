import React from 'react';
import { useTranslation } from 'react-i18next';
import type { EnvInfo } from '../../lib/net/check';
import { bypassList, dpiAdvice, excludeList, shownName } from '../../lib/net/dpi';
import { currentOs } from '../../lib/net/manual';
import { CopyLine } from './CopyLine';

interface CutStepsProps {
  env: EnvInfo | null;
  running: boolean;
  backups: boolean;
}

const DOMAIN = 'scnative.space';
const NO_ADDRS: string[] = [];

export const CutSteps = React.memo(({ env, running, backups }: CutStepsProps) => {
  const { t } = useTranslation();
  const advice = dpiAdvice(env, NO_ADDRS, currentOs());
  const name = shownName(advice);
  const exclude = excludeList(advice) ?? t('netCheck.cut.excludeAny');
  const bypass = bypassList(advice, env) ?? t('netCheck.cut.bypassAny');
  const steps = running
    ? [
        t('netCheck.cut.off', { name }),
        t('netCheck.cut.exclude', { name, file: exclude }),
        t('netCheck.cut.bypass', { name, file: bypass }),
        t('netCheck.cut.vpn'),
      ]
    : [t('netCheck.cut.bypassIdle', { file: bypass }), t('netCheck.cut.vpnIdle')];
  return (
    <>
      <p className="text-[12.5px] text-white/35 mt-1.5 leading-relaxed max-w-[340px]">
        {t(backups ? 'netCheck.cut.leadBackups' : 'netCheck.cut.leadAlone')}
      </p>
      <ol className="w-full mt-3 space-y-1.5 text-left text-[12px] text-white/60 leading-relaxed">
        {steps.map((step, at) => (
          <li key={step} className="flex gap-2">
            <span className="w-4 shrink-0 font-mono text-[10.5px] text-white/30 pt-0.5">
              {at + 1}
            </span>
            <span className="selectable">{step}</span>
          </li>
        ))}
      </ol>
      <div className="w-full mt-2.5 text-left">
        <CopyLine text={DOMAIN} />
      </div>
    </>
  );
});
