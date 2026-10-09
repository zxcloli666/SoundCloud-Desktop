import { useTranslation } from 'react-i18next';
import { chordLabels, parseAccelerator } from '../../lib/hotkeys/accelerator';
import { GLOBAL_HOTKEY_ACTIONS, withDefaults } from '../../lib/hotkeys/actions';
import { isMac, isWindows } from '../../lib/platform';
import { useSettingsStore } from '../../stores/settings';
import { KeyCaps } from '../ui/KeyCap';

export function GlobalBindingsGroup() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.globalHotkeysEnabled);
  const stored = useSettingsStore((s) => s.globalHotkeys);
  if (!enabled) return null;

  const hotkeys = withDefaults(stored);
  const assigned = GLOBAL_HOTKEY_ACTIONS.filter((action) => hotkeys[action]);
  if (assigned.length === 0) return null;

  const mac = isMac();
  const windows = isWindows();

  return (
    <div>
      <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
        {t('kb.groupGlobal')}
      </h3>
      <div className="space-y-1">
        {assigned.map((action) => (
          <div
            key={action}
            className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-colors"
          >
            <span className="text-[13px] text-white/60">{t(`hotkeys.actions.${action}`)}</span>
            <KeyCaps labels={chordLabels(parseAccelerator(hotkeys[action]), mac, windows)} />
          </div>
        ))}
      </div>
    </div>
  );
}
