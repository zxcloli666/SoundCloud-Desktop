import { openUrl } from '@tauri-apps/plugin-opener';
import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ZAPRET_GUIDE_URL } from '../../lib/constants';
import { ExternalLink } from '../../lib/icons';
import type { EnvInfo, Hint, Verdict } from '../../lib/net/check';
import { type DpiAdvice, type DpiKind, dpiAdvice } from '../../lib/net/dpi';
import { currentOs, fixCommand } from '../../lib/net/manual';
import { CopyLine } from './CopyLine';

interface HintProps {
  verdict: Verdict;
  hint: Hint;
  broken: boolean;
  env: EnvInfo | null;
  addrs: string[];
}

const ADVICE_TEXT: Record<DpiKind, string> = {
  flowseal: 'netCheck.hint.lists',
  zapret: 'netCheck.hint.exclude',
  other: 'netCheck.hint.domains',
};
const CAPTION = 'mb-1 px-1 text-[10.5px] text-white/30';

function adviceText(t: TFunction, advice: DpiAdvice): string {
  return `${t('netCheck.hint.dpi', { name: advice.name })} ${t(ADVICE_TEXT[advice.kind])}`;
}

function hintText(
  t: TFunction,
  { verdict, broken }: HintProps,
  fix: string | null,
  advice: DpiAdvice | null,
): string {
  if (broken) return t('netCheck.failedHint');
  if (fix) return t('netCheck.hint.zapretTimestamps');
  if (advice) return adviceText(t, advice);
  return t(`netCheck.verdict.${verdict}.hint`);
}

const Exclusions = React.memo(({ advice }: { advice: DpiAdvice }) => {
  const { t } = useTranslation();
  const openGuide = () => {
    openUrl(ZAPRET_GUIDE_URL).catch(() => toast.error(t('common.error')));
  };
  return (
    <div className="w-full mt-3 text-left space-y-2">
      {advice.lists.map((list) => (
        <div key={list.file ?? 'domains'}>
          {list.file && (
            <div className={`${CAPTION} font-mono truncate`} title={list.file}>
              {list.file}
            </div>
          )}
          <CopyLine text={list.lines.join('\n')} />
        </div>
      ))}
      {advice.apply && (
        <div>
          <div className={CAPTION}>{t('netCheck.hint.apply')}</div>
          <CopyLine text={advice.apply} />
        </div>
      )}
      {advice.kind === 'flowseal' && (
        <button
          type="button"
          onClick={openGuide}
          className="mx-auto flex items-center gap-1 text-[10.5px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
        >
          <ExternalLink size={10} />
          {t('netCheck.hint.guide')}
        </button>
      )}
    </div>
  );
});

export const VerdictHint = React.memo((props: HintProps) => {
  const { t } = useTranslation();
  if (props.verdict === 'checking') return null;
  const os = currentOs();
  const fix = !props.broken && props.hint === 'zapretTimestamps' ? fixCommand(os) : null;
  const advice =
    !props.broken && !fix && props.hint !== 'none' ? dpiAdvice(props.env, props.addrs, os) : null;
  return (
    <>
      <p className="text-[12.5px] text-white/35 mt-1.5 leading-relaxed max-w-[340px]">
        {hintText(t, props, fix, advice)}
      </p>
      {fix && (
        <div className="w-full mt-3 text-left">
          <CopyLine text={fix} />
          {os === 'windows' && (
            <p className="text-[10.5px] text-white/30 mt-1 text-center">
              {t('netCheck.hint.admin')}
            </p>
          )}
        </div>
      )}
      {advice && <Exclusions advice={advice} />}
    </>
  );
});
