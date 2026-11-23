import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { trackedInvoke as invoke } from '../../../lib/diagnostics';
import { Loader2, RefreshCw } from '../../../lib/icons';
import { lightenForSoftwareRendering } from '../../../lib/perf-probe';
import type { RenderMode } from '../../../lib/render-mode';
import { useSettingsStore } from '../../../stores/settings';
import { Row, Toggle } from '../primitives';

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
      .then((next) => {
        setMode(next);
        if (next.softwareRendering) lightenForSoftwareRendering();
      })
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
    <>
      <Row title={t('settings.softwareRendering')} info={t('settings.softwareRenderingDesc')}>
        <Toggle
          checked={mode.softwareRendering}
          onChange={toggle}
          disabled={saving}
          label={t('settings.softwareRendering')}
        />
      </Row>
      {mode.restartRequired && (
        <div className="flex items-center gap-2.5 rounded-[10px] bg-accent/[0.1] py-1.5 pr-1.5 pl-3">
          <RefreshCw size={14} className="shrink-0 text-accent" />
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink-80">
            {t('settings.softwareRenderingRestart')}
          </p>
          <button
            type="button"
            onClick={restart}
            disabled={restarting}
            className="set-btn h-7"
            data-tone="accent"
          >
            {restarting && <Loader2 size={12} className="animate-spin" />}
            {t('settings.restartNow')}
          </button>
        </div>
      )}
      {mode.softwareRendering && perfMode !== 'light' && (
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink-45">
            {t('settings.softwareRenderingLightHint')}
          </p>
          <button type="button" onClick={() => setPerfMode('light')} className="set-btn">
            {t('settings.useLightMode')}
          </button>
        </div>
      )}
    </>
  );
}
