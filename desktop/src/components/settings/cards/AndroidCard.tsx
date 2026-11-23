import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import {
  ANDROID_CLIENT_RELEASES_URL,
  ANDROID_CLIENT_URL,
  IOS_CLIENT_RELEASES_URL,
} from '../../../lib/constants';
import { helpUrl } from '../../../lib/help-url';
import { BookOpen, Download, ExternalLink, Smartphone } from '../../../lib/icons';
import { LinkOption } from '../LinkOption';
import { Block, Card } from '../primitives';

export function AndroidCard() {
  const { t, i18n } = useTranslation();

  return (
    <Card
      title={t('settings.android')}
      desc={t('settings.androidDesc')}
      icon={<Smartphone size={17} />}
      action={<span className="set-chip text-ok">{t('settings.androidOfficial')}</span>}
    >
      <Block className="space-y-3">
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
        <p className="text-[12px] leading-snug text-ink-45">{t('settings.androidNote')}</p>
      </Block>
      <Block className="space-y-3">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink-90">
          <Smartphone size={15} className="text-ink-45" />
          {t('settings.ios')}
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <LinkOption
            icon={<Download size={17} />}
            title={t('settings.iosDownload')}
            desc={t('settings.iosDownloadDesc')}
            trailing={<ExternalLink size={14} />}
            onClick={() => openUrl(IOS_CLIENT_RELEASES_URL)}
          />
          <LinkOption
            icon={<BookOpen size={17} />}
            title={t('settings.iosInstall')}
            desc={t('settings.iosInstallDesc')}
            trailing={<ExternalLink size={14} />}
            onClick={() => openUrl(helpUrl('install/ios', i18n.language))}
          />
        </div>
      </Block>
    </Card>
  );
}
