import { useTranslation } from 'react-i18next';
import { MonitorPlay } from '../../../../lib/icons';
import { obsOrigin, overlayUrl } from '../../../../lib/obs/format';
import { useObsStatusStore } from '../../../../stores/obs-status';
import { useSettingsStore } from '../../../../stores/settings';
import { Row, Toggle } from '../../primitives';
import { CopyField } from './CopyField';
import { OverlayPreview } from './OverlayPreview';
import { Hint, Label, Panel } from './Panel';
import { PortField } from './PortField';
import { ServerBadge } from './ServerBadge';
import { ThemePicker } from './ThemePicker';

const PREVIEW_SCALE = 0.82;

export function OverlayPanel() {
  const { t, i18n } = useTranslation();
  const enabled = useSettingsStore((s) => s.obsServer);
  const setEnabled = useSettingsStore((s) => s.setObsServer);
  const port = useSettingsStore((s) => s.obsPort);
  const setPort = useSettingsStore((s) => s.setObsPort);
  const theme = useSettingsStore((s) => s.obsTheme);
  const setTheme = useSettingsStore((s) => s.setObsTheme);
  const progress = useSettingsStore((s) => s.obsProgress);
  const setProgress = useSettingsStore((s) => s.setObsProgress);
  const hidePaused = useSettingsStore((s) => s.obsHidePaused);
  const setHidePaused = useSettingsStore((s) => s.setObsHidePaused);
  const status = useObsStatusStore((s) => s.status);
  const running = status?.server === 'running' && status.port === port;

  const options = { port, theme, progress, hidePaused, lang: i18n.language.split('-')[0] };
  const link = overlayUrl(options);
  const origin = obsOrigin(port);

  return (
    <Panel
      icon={<MonitorPlay size={17} />}
      title={t('settings.obsOverlay')}
      desc={t('settings.obsOverlayDesc')}
      checked={enabled}
      onToggle={() => setEnabled(!enabled)}
    >
      <ServerBadge status={status} port={port} />
      {running && <OverlayPreview url={overlayUrl({ ...options, scale: PREVIEW_SCALE })} />}
      <div className="space-y-2">
        <Label>{t('settings.obsTheme')}</Label>
        <ThemePicker value={theme} onChange={setTheme} />
      </div>
      <div>
        <Row title={t('settings.obsProgress')} desc={t('settings.obsProgressDesc')}>
          <Toggle checked={progress} onChange={() => setProgress(!progress)} />
        </Row>
        <Row title={t('settings.obsHidePaused')} desc={t('settings.obsHidePausedDesc')}>
          <Toggle checked={hidePaused} onChange={() => setHidePaused(!hidePaused)} />
        </Row>
      </div>
      <div className="space-y-2">
        <Label>{t('settings.obsLink')}</Label>
        <CopyField value={link} />
        <Hint>{t('settings.obsOverlayHint')}</Hint>
      </div>
      <PortField port={port} onChange={setPort} />
      <div className="space-y-2">
        <div className="space-y-0.5">
          <Label>{t('settings.obsApi')}</Label>
          <Hint>{t('settings.obsApiDesc')}</Hint>
        </div>
        <CopyField label="JSON" value={`${origin}/np.json`} />
        <CopyField label="TXT" value={`${origin}/np.txt`} />
      </div>
    </Panel>
  );
}
