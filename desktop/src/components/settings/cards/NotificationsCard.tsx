import { useTranslation } from 'react-i18next';
import { Bell } from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { Card, Row, Toggle } from '../primitives';

export function NotificationsCard() {
  const { t } = useTranslation();
  const showErrorToasts = useSettingsStore((s) => s.showErrorToasts);
  const setShowErrorToasts = useSettingsStore((s) => s.setShowErrorToasts);

  return (
    <Card title={t('settings.notifications')} icon={<Bell size={17} />}>
      <Row title={t('settings.showErrorToasts')} desc={t('settings.showErrorToastsDesc')}>
        <Toggle checked={showErrorToasts} onChange={() => setShowErrorToasts(!showErrorToasts)} />
      </Row>
    </Card>
  );
}
