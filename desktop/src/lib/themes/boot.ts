import { useThemesStore } from '../../stores/themes';
import { describeError, trackedInvoke as invoke, logError } from '../diagnostics';
import { safeModeOff } from '../safe-mode';
import { crashedTheme } from './crash-guard';
import { applyLook } from './look';
import { activeTheme } from './records';
import { clearSentinel, readSentinel, writeSentinel } from './sentinel';

export async function bootThemes() {
  try {
    await useThemesStore.persist.rehydrate();
    useThemesStore.setState({ hydrated: true });
    if (await invoke<boolean>('custom_css_suppressed').catch(() => false)) safeModeOff('flag');

    const sentinel = await readSentinel();
    const state = useThemesStore.getState();
    const theme = activeTheme(state);
    if (sentinel) await clearSentinel();
    if (theme && crashedTheme(sentinel, state.activeId, theme.hash)) {
      useThemesStore.setState({ enabled: false });
      state.notify([{ kind: 'crashOff', id: sentinel.id, name: theme.name }]);
    } else if (theme && state.activeId && document.visibilityState === 'visible') {
      await writeSentinel(state.activeId, theme.hash);
    }
  } catch (error) {
    logError(`[Themes] boot failed: ${describeError(error)}`);
  }
  await applyLook().catch((error) => logError(`[Themes] apply failed: ${describeError(error)}`));
}
