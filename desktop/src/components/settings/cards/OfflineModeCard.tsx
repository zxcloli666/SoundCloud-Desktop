import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Heart, WifiOff } from '../../../lib/icons';
import { setOfflineMode } from '../../../lib/offline-mode';
import { useAppStatusStore } from '../../../stores/app-status';
import type { OfflineSection } from '../../offline/types';
import { ActionButton } from '../ActionButton';
import { Card, Toggle } from '../primitives';

export function OfflineModeCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const on = useAppStatusStore((s) => s.offlineMode);
  const open = (section: OfflineSection) => navigate('/offline', { state: { section } });

  return (
    <Card
      title={t('settings.offlineMode')}
      desc={t('settings.offlineModeDesc')}
      icon={<WifiOff size={17} />}
      action={
        <Toggle
          checked={on}
          onChange={() => void setOfflineMode(!on)}
          label={t('settings.offlineMode')}
        />
      }
    >
      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<Heart size={12} />}
          label={t('offline.likesTitle')}
          onClick={() => open('likes')}
        />
        <ActionButton
          icon={<FolderOpen size={12} />}
          label={t('local.tab')}
          onClick={() => open('local')}
        />
      </div>
    </Card>
  );
}
