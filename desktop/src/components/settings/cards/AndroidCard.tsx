import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { ANDROID_CLIENT_RELEASES_URL, ANDROID_CLIENT_URL } from '../../../lib/constants';
import { Download, ExternalLink, Smartphone } from '../../../lib/icons';
import { LinkOption } from '../LinkOption';
import { Card } from '../primitives';

export function AndroidCard() {
  const { t } = useTranslation();

  return (
    <Card
      title={t('settings.android')}
      desc={t('settings.androidDesc')}
      icon={<Smartphone size={17} />}
      action={
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/45 bg-white/[0.05] border border-white/[0.08]">
          {t('settings.androidUnofficial')}
        </span>
      }
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <LinkOption
          icon={<Download size={17} />}
          title={t('settings.androidDownload')}
          desc={t('settings.androidDownloadDesc')}
          trailing={<ExternalLink size={14} />}
          onClick={() => openUrl(ANDROID_CLIENT_RELEASES_URL)}
        />
        <LinkOption
          icon={<ExternalLink size={17} />}
          title={t('settings.androidSource')}
          desc={t('settings.androidSourceDesc')}
          trailing={<ExternalLink size={14} />}
          onClick={() => openUrl(ANDROID_CLIENT_URL)}
        />
      </div>
      <p className="mt-3.5 text-[11.5px] text-white/35 leading-snug">{t('settings.androidNote')}</p>
    </Card>
  );
}
