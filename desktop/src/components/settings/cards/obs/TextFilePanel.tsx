import { useTranslation } from 'react-i18next';
import { FileText, FolderOpen } from '../../../../lib/icons';
import { renderTemplate } from '../../../../lib/obs/format';
import { getArtistDisplay, getDisplayTitle } from '../../../../lib/track-display';
import { useObsStatusStore } from '../../../../stores/obs-status';
import { usePlayerStore } from '../../../../stores/player';
import { useSettingsStore } from '../../../../stores/settings';
import { Hint, Label, Panel } from './Panel';
import { TemplateField } from './TemplateField';

async function pickFile(filterName: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({
    defaultPath: 'now-playing.txt',
    filters: [{ name: filterName, extensions: ['txt'] }],
  }).catch(() => null);
}

function Output({ template }: { template: string }) {
  const { t } = useTranslation();
  const track = usePlayerStore((s) => s.currentTrack);
  const title = track ? getDisplayTitle(track) : t('settings.discordRpcStatusSampleTrack');
  const artist = track
    ? getArtistDisplay(track).primary || track.user?.username || ''
    : t('settings.discordRpcStatusSampleArtist');

  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/25 px-3 py-2.5">
      <p className="whitespace-pre-wrap break-words font-mono text-[13px] text-white/85">
        {renderTemplate(template, artist, title)}
      </p>
    </div>
  );
}

export function TextFilePanel() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.obsTxt);
  const setEnabled = useSettingsStore((s) => s.setObsTxt);
  const path = useSettingsStore((s) => s.obsTxtPath);
  const setPath = useSettingsStore((s) => s.setObsTxtPath);
  const template = useSettingsStore((s) => s.obsTemplate);
  const setTemplate = useSettingsStore((s) => s.setObsTemplate);
  const error = useObsStatusStore((s) => s.status?.txtError ?? null);

  const choose = async () => {
    const picked = await pickFile(t('settings.obsText'));
    if (picked) setPath(picked);
    return picked;
  };

  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    if (path || (await choose())) setEnabled(true);
  };

  return (
    <Panel
      icon={<FileText size={17} />}
      title={t('settings.obsText')}
      desc={t('settings.obsTextDesc')}
      checked={enabled}
      onToggle={() => void toggle()}
    >
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 py-1.5 pr-1.5 pl-3">
        <p
          className={`min-w-0 flex-1 truncate font-mono text-[12px] ${path ? 'text-white/70' : 'text-white/30'}`}
          title={path}
        >
          {path || t('settings.obsTextNoFile')}
        </p>
        <button
          type="button"
          onClick={() => void choose()}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-semibold text-white/65 transition-colors hover:bg-white/[0.1] hover:text-white/85"
        >
          <FolderOpen size={13} />
          {t(path ? 'settings.obsTextChange' : 'settings.obsTextChoose')}
        </button>
      </div>
      {error && (
        <div className="rounded-lg border border-[#ff453a]/20 bg-[#ff453a]/[0.08] px-2.5 py-1.5 text-[12px] text-[#ff8a80]">
          {t('settings.obsTextError', { error })}
        </div>
      )}
      <div className="space-y-2">
        <Label>{t('settings.obsTemplate')}</Label>
        <TemplateField value={template} onChange={setTemplate} />
      </div>
      <div className="space-y-2">
        <Label>{t('settings.obsTextPreview')}</Label>
        <Output template={template} />
        <Hint>{t('settings.obsTextHint')}</Hint>
      </div>
    </Panel>
  );
}
