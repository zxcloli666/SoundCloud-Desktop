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
import { Card } from '../primitives';

export function AndroidCard() {
  const { t, i18n } = useTranslation();

  return (
    <Card
      title={t('settings.android')}
      desc={t('settings.androidDesc')}
      icon={<Smartphone size={17} />}
      action={
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300/75 bg-emerald-400/[0.08] border border-emerald-400/[0.18]">
          {t('settings.androidOfficial')}
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
      <p className="mt-3.5 text-[11.5px] text-ink-35 leading-snug">{t('settings.androidNote')}</p>
      <div className="mt-4 mb-2.5 flex items-center gap-2 text-[12.5px] font-medium text-ink-60">
        <Smartphone size={15} className="text-ink-35" />
        {t('settings.ios')}
      </div>
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
    </Card>
  );
}
