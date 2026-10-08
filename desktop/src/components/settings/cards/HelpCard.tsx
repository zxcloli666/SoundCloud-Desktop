import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { DISCORD_URL, DOCS_URL } from '../../../lib/constants';
import { trackedInvoke } from '../../../lib/diagnostics';
import { Activity, BookOpen, FolderOpen, LifeBuoy, MessageCircle } from '../../../lib/icons';
import { useNetCheckStore } from '../../../lib/net/check';
import { notifyError } from '../../../lib/notify';
import { ActionButton } from '../ActionButton';
import { Card, Divider, Row } from '../primitives';

function errorGuideUrl(language: string): string {
  return `${DOCS_URL}/${language.startsWith('ru') ? 'ERRORS.ru.md' : 'ERRORS.md'}`;
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
      <Row title={t('settings.helpNetCheck')} desc={t('settings.helpNetCheckDesc')}>
        <ActionButton
          icon={<Activity size={12} />}
          label={t('settings.helpNetCheckOpen')}
          onClick={() => useNetCheckStore.getState().openCheck()}
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
