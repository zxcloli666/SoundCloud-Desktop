import { openUrl } from '@tauri-apps/plugin-opener';
import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { helpUrl } from '../../lib/help-url';
import { ExternalLink } from '../../lib/icons';
import type { EnvInfo, Hint, Verdict } from '../../lib/net/check';
import { type DpiAdvice, type DpiKind, dpiAdvice } from '../../lib/net/dpi';
import { currentOs, fixCommand } from '../../lib/net/manual';
import { CopyLine } from './CopyLine';
import { CutSteps } from './CutSteps';
import { CAPTION, ListLines } from './ListLines';

interface HintProps {
  verdict: Verdict;
  hint: Hint;
  broken: boolean;
  env: EnvInfo | null;
  addrs: string[];
  backups: boolean;
}

const ADVICE_TEXT: Record<DpiKind, string> = {
  flowseal: 'netCheck.hint.lists',
  zapret: 'netCheck.hint.exclude',
  goodbyedpi: 'netCheck.hint.blacklist',
  other: 'netCheck.hint.domains',
};

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
  const { t, i18n } = useTranslation();
  const openGuide = () => {
    openUrl(helpUrl('zapret', i18n.language)).catch(() => toast.error(t('common.error')));
  };
  return (
    <div className="w-full mt-3 text-left space-y-2">
      {advice.lists.map((list) => (
        <ListLines key={list.file ?? 'domains'} list={list} />
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
          className="mx-auto flex items-center gap-1 text-[10.5px] text-ink-30 hover:text-ink-60 transition-colors cursor-pointer"
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
  if (!props.broken && props.verdict === 'cut') {
    return (
      <CutSteps
        env={props.env}
        addrs={props.addrs}
        running={props.hint === 'zapretCut'}
        backups={props.backups}
      />
    );
  }
  const os = currentOs();
  const fix = !props.broken && props.hint === 'zapretTimestamps' ? fixCommand(os) : null;
  const advice =
    !props.broken && !fix && props.hint !== 'none' ? dpiAdvice(props.env, props.addrs, os) : null;
  return (
    <>
      <p className="text-[12.5px] text-ink-35 mt-1.5 leading-relaxed max-w-[340px]">
        {hintText(t, props, fix, advice)}
      </p>
      {fix && (
        <div className="w-full mt-3 text-left">
          <CopyLine text={fix} />
          {os === 'windows' && (
            <p className="text-[10.5px] text-ink-30 mt-1 text-center">
              {t('netCheck.hint.admin')}
            </p>
          )}
        </div>
      )}
      {advice && (advice.lists.length > 0 || advice.apply) && <Exclusions advice={advice} />}
    </>
  );
});
