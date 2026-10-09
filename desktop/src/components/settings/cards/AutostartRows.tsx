import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  type AutostartState,
  getAutostart,
  setAutostartEnabled,
  setAutostartMinimized,
} from '../../../lib/autostart';
import { AlertCircle } from '../../../lib/icons';
import { Row, Toggle } from '../primitives';

export function AutostartRows() {
  const { t } = useTranslation();
  const [state, setState] = useState<AutostartState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAutostart()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  if (!state) return null;

  const toggleEnabled = () => {
    const enabled = !state.enabled;
    setSaving(true);
    setAutostartEnabled(enabled, t('settings.autostartPortalReason'))
      .then((next) => {
        setState(next);
        if (next.enabled !== enabled) toast.error(t('settings.autostartDenied'));
      })
      .catch(() => toast.error(t('settings.autostartFailed')))
      .finally(() => setSaving(false));
  };

  const toggleMinimized = () => {
    setSaving(true);
    setAutostartMinimized(!state.startMinimized)
      .then(setState)
      .catch(() => toast.error(t('settings.autostartFailed')))
      .finally(() => setSaving(false));
  };

  return (
    <div className="mt-4 border-t border-white/[0.05] pt-4">
      <Row title={t('settings.autostart')} desc={t('settings.autostartDesc')}>
        <Toggle
          checked={state.enabled}
          onChange={toggleEnabled}
          disabled={saving}
          label={t('settings.autostart')}
        />
      </Row>
      <Row title={t('settings.autostartMinimized')} desc={t('settings.autostartMinimizedDesc')}>
        <Toggle
          checked={state.startMinimized && state.trayAvailable}
          onChange={toggleMinimized}
          disabled={saving || !state.enabled || !state.trayAvailable}
          label={t('settings.autostartMinimized')}
        />
      </Row>
      {state.enabled && !state.trayAvailable && (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] px-3.5 py-2.5">
          <AlertCircle size={14} className="shrink-0 mt-px text-amber-300/90" />
          <p className="min-w-0 text-[11.5px] leading-snug text-white/60">
            {t('settings.autostartNoTray')}
          </p>
        </div>
      )}
    </div>
  );
}
