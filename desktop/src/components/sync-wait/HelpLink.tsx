import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { helpUrl } from '../../lib/help-url';
import { ExternalLink } from '../../lib/icons';

export function HelpLink({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const open = () => void openUrl(helpUrl('fix/sync', i18n.language)).catch(() => undefined);

  if (compact) {
    return (
      <button
        type="button"
        onClick={open}
        title={t('sync.learnMore')}
        aria-label={t('sync.learnMore')}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-ink-40 transition-colors hover:bg-ink/[0.06] hover:text-ink-85"
      >
        <ExternalLink size={13} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-1 text-[12px] font-semibold text-ink-55 transition-colors hover:text-ink-90"
    >
      <ExternalLink size={12} />
      {t('sync.learnMore')}
    </button>
  );
}
