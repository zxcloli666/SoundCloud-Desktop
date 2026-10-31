import React from 'react';
import { useTranslation } from 'react-i18next';
import type { EnvInfo } from '../../lib/net/check';
import { addrsList, bypassList, dpiAdvice, excludeList, shownName } from '../../lib/net/dpi';
import { currentOs } from '../../lib/net/manual';
import { CopyLine } from './CopyLine';
import { ListLines } from './ListLines';

interface CutStepsProps {
  env: EnvInfo | null;
  addrs: string[];
  running: boolean;
  backups: boolean;
}

const DOMAINS = ['scnative.dev'];

export const CutSteps = React.memo(({ env, addrs, running, backups }: CutStepsProps) => {
  const { t } = useTranslation();
  const advice = dpiAdvice(env, addrs, currentOs());
  const name = shownName(advice);
  const exclude = excludeList(advice) ?? t('netCheck.cut.excludeAny');
  const bypass = bypassList(advice, env) ?? t('netCheck.cut.bypassAny');
  const addrsFile = running && addrs.length > 0 ? addrsList(advice) : null;
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
      <p className="text-[12.5px] text-ink-35 mt-1.5 leading-relaxed max-w-[340px]">
        {t(backups ? 'netCheck.cut.leadBackups' : 'netCheck.cut.leadAlone')}
      </p>
      <ol className="w-full mt-3 space-y-1.5 text-left text-[12px] text-ink-60 leading-relaxed">
        {steps.map((step, at) => (
          <li key={step} className="flex gap-2">
            <span className="w-4 shrink-0 font-mono text-[10.5px] text-ink-30 pt-0.5">
              {at + 1}
            </span>
            <span className="selectable">{step}</span>
          </li>
        ))}
      </ol>
      <div className="w-full mt-2.5 text-left space-y-2">
        <CopyLine text={DOMAINS.join('\n')} />
        {addrsFile && <ListLines list={{ file: addrsFile, lines: addrs }} />}
      </div>
    </>
  );
});
