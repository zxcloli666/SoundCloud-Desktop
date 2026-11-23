import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { DISCORD_URL, TELEGRAM_URL } from '../../../lib/constants';
import { trackedInvoke } from '../../../lib/diagnostics';
import { helpUrl } from '../../../lib/help-url';
import { Activity, BookOpen, FolderOpen, LifeBuoy, MessageCircle, Send } from '../../../lib/icons';
import { useNetCheckStore } from '../../../lib/net/check';
import { notifyError } from '../../../lib/notify';
import { ReportButton } from '../../ui/ReportButton';
import { ActionButton } from '../ActionButton';
import { Card, Row } from '../primitives';

export function HelpCard() {
  const { t, i18n } = useTranslation();

  const revealLog = () => {
    trackedInvoke('diagnostics_reveal_log').catch(() => notifyError(t('settings.helpLogFailed')));
  };

  return (
    <Card title={t('settings.help')} desc={t('settings.helpDesc')} icon={<LifeBuoy size={17} />}>
      <Row title={t('settings.helpErrors')} desc={t('settings.helpErrorsDesc')}>
        <ActionButton
          icon={<BookOpen size={13} />}
          label={t('settings.helpErrorsOpen')}
          onClick={() => openUrl(helpUrl('errors', i18n.language))}
        />
      </Row>
      <Row title={t('settings.helpNetCheck')} desc={t('settings.helpNetCheckDesc')}>
        <ActionButton
          icon={<Activity size={13} />}
          label={t('settings.helpNetCheckOpen')}
          onClick={() => useNetCheckStore.getState().openCheck()}
        />
      </Row>
      <Row title={t('diag.report')} desc={t('diag.reportDesc')}>
        <ReportButton trigger="manual" className="set-btn" />
      </Row>
      <Row title={t('settings.helpLog')} desc={t('settings.helpLogDesc')}>
        <ActionButton
          icon={<FolderOpen size={13} />}
          label={t('settings.helpLogOpen')}
          onClick={revealLog}
        />
      </Row>
      <Row title={t('settings.helpDiscord')} desc={t('settings.helpDiscordDesc')}>
        <ActionButton
          icon={<MessageCircle size={13} />}
          label={t('settings.helpDiscordOpen')}
          onClick={() => openUrl(DISCORD_URL)}
        />
      </Row>
      <Row title={t('settings.helpTelegram')} desc={t('settings.helpTelegramDesc')}>
        <ActionButton
          icon={<Send size={13} />}
          label={t('settings.helpTelegramOpen')}
          onClick={() => openUrl(TELEGRAM_URL)}
        />
      </Row>
    </Card>
  );
}
