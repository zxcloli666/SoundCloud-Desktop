import { openUrl } from '@tauri-apps/plugin-opener';
import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ZAPRET_GUIDE_URL } from '../../lib/constants';
import { ExternalLink } from '../../lib/icons';
import type { Hint, Verdict } from '../../lib/net/check';
import { currentOs, EXCLUDED_DOMAINS, fixCommand } from '../../lib/net/manual';
import { CopyLine } from './CopyLine';

interface HintProps {
  verdict: Verdict;
  hint: Hint;
  broken: boolean;
}

function hintText(t: TFunction, { verdict, hint, broken }: HintProps, fix: string | null): string {
  if (broken) return t('netCheck.failedHint');
  if (fix) return t('netCheck.hint.zapretTimestamps');
  if (hint === 'none') return t(`netCheck.verdict.${verdict}.hint`);
  return t('netCheck.hint.zapret');
}

const ZapretExclusions = React.memo(() => {
  const { t } = useTranslation();
  const openGuide = () => {
    openUrl(ZAPRET_GUIDE_URL).catch(() => toast.error(t('common.error')));
  };
  return (
    <div className="w-full mt-3 text-left">
      <CopyLine text={EXCLUDED_DOMAINS.join('\n')} />
      <button
        type="button"
        onClick={openGuide}
        className="mx-auto mt-1.5 flex items-center gap-1 text-[10.5px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
      >
        <ExternalLink size={10} />
        {t('netCheck.hint.guide')}
      </button>
    </div>
  );
});

export const VerdictHint = React.memo((props: HintProps) => {
  const { t } = useTranslation();
  if (props.verdict === 'checking') return null;
  const os = currentOs();
  const fix = !props.broken && props.hint === 'zapretTimestamps' ? fixCommand(os) : null;
  const exclude = !props.broken && props.hint === 'zapret';
  return (
    <>
      <p className="text-[12.5px] text-white/35 mt-1.5 leading-relaxed max-w-[340px]">
        {hintText(t, props, fix)}
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
      {exclude && <ZapretExclusions />}
    </>
  );
});
