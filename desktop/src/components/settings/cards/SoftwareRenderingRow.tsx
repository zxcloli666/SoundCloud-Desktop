import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { trackedInvoke as invoke } from '../../../lib/diagnostics';
import { Loader2, RefreshCw } from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { Row, Toggle } from '../primitives';

interface RenderMode {
  supported: boolean;
  softwareRendering: boolean;
  restartRequired: boolean;
}

export function SoftwareRenderingRow() {
  const { t } = useTranslation();
  const perfMode = useSettingsStore((s) => s.perfMode);
  const setPerfMode = useSettingsStore((s) => s.setPerfMode);
  const [mode, setMode] = useState<RenderMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    invoke<RenderMode>('render_mode_get')
      .then(setMode)
      .catch(() => setMode(null));
  }, []);

  if (!mode?.supported) return null;

  const toggle = () => {
    setSaving(true);
    invoke<RenderMode>('render_mode_set', { softwareRendering: !mode.softwareRendering })
      .then(setMode)
      .catch(() => toast.error(t('settings.softwareRenderingFailed')))
      .finally(() => setSaving(false));
  };

  const restart = () => {
    setRestarting(true);
    invoke('render_mode_restart').catch(() => {
      setRestarting(false);
      toast.error(t('common.error'));
    });
  };

  return (
    <div className="mt-4 border-t border-white/[0.05] pt-4">
      <Row title={t('settings.softwareRendering')} desc={t('settings.softwareRenderingDesc')}>
        <Toggle checked={mode.softwareRendering} onChange={toggle} disabled={saving} />
      </Row>
      {mode.restartRequired && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/[0.06] px-3.5 py-2.5">
          <RefreshCw size={14} className="shrink-0 text-accent" />
          <p className="flex-1 min-w-0 text-[12px] leading-snug text-white/70">
            {t('settings.softwareRenderingRestart')}
          </p>
          <button
            type="button"
            onClick={restart}
            disabled={restarting}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-accent text-accent-contrast hover:bg-accent-hover active:scale-[0.97] transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-default"
          >
            {restarting && <Loader2 size={12} className="animate-spin" />}
            {t('settings.restartNow')}
          </button>
        </div>
      )}
      {mode.softwareRendering && perfMode !== 'light' && (
        <div className="mt-3 flex items-center gap-3 px-1">
          <p className="flex-1 min-w-0 text-[11.5px] leading-snug text-white/40">
            {t('settings.softwareRenderingLightHint')}
          </p>
          <button
            type="button"
            onClick={() => setPerfMode('light')}
            className="shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-white/[0.06] text-white/75 hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
          >
            {t('settings.useLightMode')}
          </button>
        </div>
      )}
    </div>
  );
}
