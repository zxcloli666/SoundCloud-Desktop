import { useTranslation } from 'react-i18next';
import { chordProblem, type KeyChord, toAccelerator } from '../../../lib/hotkeys/accelerator';
import { GLOBAL_HOTKEY_ACTIONS, withDefaults } from '../../../lib/hotkeys/actions';
import { Keyboard, PictureInPicture2, RotateCcw } from '../../../lib/icons';
import { isMac, isWindows } from '../../../lib/platform';
import { CHAT_HOTKEY_DEFAULT, useChatPrefsStore } from '../../../stores/chat/prefs';
import { useSettingsStore } from '../../../stores/settings';
import { HotkeyRow } from '../../settings/cards/HotkeyRow';
import { Card } from '../../settings/primitives';

function superKeyName(): string {
  if (isMac()) return '⌘';
  return isWindows() ? 'Win' : 'Super';
}

export function DockHotkeyCard() {
  const { t } = useTranslation();
  const hotkey = useChatPrefsStore((state) => state.hotkey);
  const setHotkey = useChatPrefsStore((state) => state.setHotkey);
  const globals = useSettingsStore((state) => state.globalHotkeys);

  const validate = (chord: KeyChord) => {
    const problem = chordProblem(chord);
    if (problem) return t(`chat.settings.dock.problem.${problem}`, { super: superKeyName() });
    const accelerator = toAccelerator(chord);
    const hotkeys = withDefaults(globals);
    const owner = GLOBAL_HOTKEY_ACTIONS.find((action) => hotkeys[action] === accelerator);
    if (owner) {
      return t('chat.settings.dock.problem.duplicate', { action: t(`hotkeys.actions.${owner}`) });
    }
    return null;
  };

  return (
    <Card
      title={t('chat.settings.dock.title')}
      icon={<PictureInPicture2 size={17} />}
      action={
        hotkey !== CHAT_HOTKEY_DEFAULT && (
          <button
            type="button"
            onClick={() => setHotkey(CHAT_HOTKEY_DEFAULT)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink/[0.06] bg-ink/[0.06] px-3 py-1.5 text-[12px] font-semibold text-ink-75 transition-colors hover:bg-ink/[0.1]"
          >
            <RotateCcw size={12} />
            {t('chat.settings.dock.reset')}
          </button>
        )
      }
    >
      <HotkeyRow
        icon={<Keyboard size={14} />}
        label={t('chat.settings.dock.hotkey')}
        value={hotkey}
        status={undefined}
        validate={validate}
        onChange={setHotkey}
      />
    </Card>
  );
}
