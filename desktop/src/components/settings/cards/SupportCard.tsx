import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BOOSTY_URL } from '../../../lib/constants';
import { ChevronRight, ExternalLink, Heart, Star } from '../../../lib/icons';
import { LinkOption } from '../LinkOption';
import { Card } from '../primitives';

export function SupportCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card
      title={t('settings.support')}
      desc={t('settings.supportDesc')}
      icon={<Heart size={17} fill="currentColor" />}
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <LinkOption
          icon={<Heart size={17} fill="currentColor" />}
          title={t('settings.supportDonate')}
          desc={t('settings.supportDonateDesc')}
          trailing={<ExternalLink size={14} />}
          onClick={() => openUrl(BOOSTY_URL)}
        />
        <LinkOption
          icon={<Star size={17} fill="currentColor" />}
          title={t('settings.supportStar')}
          desc={t('settings.supportStarDesc')}
          trailing={<ChevronRight size={16} />}
          onClick={() => navigate('/star')}
        />
      </div>
    </Card>
  );
}
