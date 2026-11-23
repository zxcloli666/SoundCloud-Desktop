import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  type AutostartState,
  getAutostart,
  setAutostartEnabled,
  setAutostartMinimized,
} from '../../../lib/autostart';
import { Row, Toggle } from '../primitives';
import { Notice } from './Notice';

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
    <>
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
      {state.enabled && !state.trayAvailable && <Notice>{t('settings.autostartNoTray')}</Notice>}
    </>
  );
}
