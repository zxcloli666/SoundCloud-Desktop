import { openUrl } from '@tauri-apps/plugin-opener';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DISCORD_URL, GITHUB_OWNER, GITHUB_REPO } from '../../../lib/constants';
import { trackedInvoke } from '../../../lib/diagnostics';
import { BookOpen, FolderOpen, LifeBuoy, MessageCircle } from '../../../lib/icons';
import { notifyError } from '../../../lib/notify';
import { Card, Divider, Row } from '../primitives';

const DOCS_BASE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/main/docs`;

function errorGuideUrl(language: string): string {
  return `${DOCS_BASE}/${language.startsWith('ru') ? 'ERRORS.ru.md' : 'ERRORS.md'}`;
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.06] text-white/75 hover:bg-white/[0.1] hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
    >
      {icon}
      {label}
    </button>
  );
}

export function HelpCard() {
  const { t, i18n } = useTranslation();

  const revealLog = () => {
    trackedInvoke('diagnostics_reveal_log').catch(() => notifyError(t('settings.helpLogFailed')));
  };

  return (
    <Card title={t('settings.help')} desc={t('settings.helpDesc')} icon={<LifeBuoy size={17} />}>
      <Row title={t('settings.helpErrors')} desc={t('settings.helpErrorsDesc')}>
        <ActionButton
          icon={<BookOpen size={12} />}
          label={t('settings.helpErrorsOpen')}
          onClick={() => openUrl(errorGuideUrl(i18n.language))}
        />
      </Row>
      <Divider />
      <Row title={t('settings.helpLog')} desc={t('settings.helpLogDesc')}>
        <ActionButton
          icon={<FolderOpen size={12} />}
          label={t('settings.helpLogOpen')}
          onClick={revealLog}
        />
      </Row>
      <Divider />
      <Row title={t('settings.helpDiscord')} desc={t('settings.helpDiscordDesc')}>
        <ActionButton
          icon={<MessageCircle size={12} />}
          label={t('settings.helpDiscordOpen')}
          onClick={() => openUrl(DISCORD_URL)}
        />
      </Row>
    </Card>
  );
}
