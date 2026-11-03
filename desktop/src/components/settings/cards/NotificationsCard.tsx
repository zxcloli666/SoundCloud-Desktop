import { useTranslation } from 'react-i18next';
import { Bell } from '../../../lib/icons';
import { usePremium } from '../../../lib/premium-cache';
import { useSettingsStore } from '../../../stores/settings';
import { Card, LockedToggle, PremiumBadge, Row, Toggle } from '../primitives';

export function NotificationsCard() {
  const { t } = useTranslation();
  const premium = usePremium();
  const showErrorToasts = useSettingsStore((s) => s.showErrorToasts);
  const setShowErrorToasts = useSettingsStore((s) => s.setShowErrorToasts);
  const releaseNotifications = useSettingsStore((s) => s.releaseNotifications);
  const setReleaseNotifications = useSettingsStore((s) => s.setReleaseNotifications);

  return (
    <Card title={t('settings.notifications')} icon={<Bell size={17} />}>
      <Row title={t('settings.showErrorToasts')} desc={t('settings.showErrorToastsDesc')}>
        <Toggle checked={showErrorToasts} onChange={() => setShowErrorToasts(!showErrorToasts)} />
      </Row>
      <Row
        title={
          <>
            {t('settings.releaseNotifications')}
            <PremiumBadge />
          </>
        }
        desc={t('settings.releaseNotificationsDesc')}
      >
        {premium ? (
          <Toggle
            checked={releaseNotifications}
            onChange={() => setReleaseNotifications(!releaseNotifications)}
          />
        ) : (
          <LockedToggle />
        )}
      </Row>
    </Card>
  );
}
