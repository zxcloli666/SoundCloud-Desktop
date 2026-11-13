import { openUrl } from '@tauri-apps/plugin-opener';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ExternalLink } from '../../../lib/icons';
import { CREDIT_GROUPS, CREDITS, type Credit, creditsOf } from '../../../lib/voice/credits';
import { Card } from '../../settings/primitives';

export function CreditsCard() {
  const { t } = useTranslation();
  return (
    <Card
      title={t('voice.credits.title')}
      icon={<BookOpen size={17} />}
      action={
        <span className="font-mono text-[11.5px] tabular-nums text-ink-45">{CREDITS.length}</span>
      }
    >
      <div data-ui="voice-credits" className="space-y-5">
        {CREDIT_GROUPS.map((group) => (
          <section key={group}>
            <h4 className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-35">
              {t(`voice.credits.group.${group}`)}
            </h4>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(16.5rem,1fr))] gap-x-3">
              {creditsOf(group).map((credit) => (
                <CreditRow key={credit.id} credit={credit} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

const CreditRow = memo(function CreditRow({ credit }: { credit: Credit }) {
  const { t } = useTranslation();
  const use = t(`voice.credits.use.${credit.use}`);
  return (
    <button
      type="button"
      onClick={() => void openUrl(credit.url).catch(() => undefined)}
      aria-label={t('voice.credits.open', { name: credit.name })}
      className="group/credit -mx-2 flex min-w-0 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-200 hover:bg-ink/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-ink-85">{credit.name}</span>
          <ExternalLink
            size={11}
            className="shrink-0 text-ink-30 opacity-0 transition-opacity duration-200 group-hover/credit:opacity-100 group-focus-visible/credit:opacity-100"
          />
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-40">
          {credit.by ? `${use} · ${credit.by}` : use}
        </span>
      </span>
      <span className="mt-px shrink-0 rounded-md bg-ink/[0.07] px-1.5 py-[2px] font-mono text-[10px] font-bold text-ink-55">
        {credit.license}
      </span>
    </button>
  );
});
