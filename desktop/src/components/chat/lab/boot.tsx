import ReactDOM from 'react-dom/client';
import { NEWS } from '../../../lib/constants';
import { trackedInvoke as invoke } from '../../../lib/diagnostics';
import { useNewsStore } from '../../../stores/news';
import { useSettingsStore } from '../../../stores/settings';
import { inAppWindow } from './ipc';
import { createKit } from './kit';
import { forceReducedMotion } from './motion';
import { readParams } from './params';
import { reportScene, runScene } from './ready';
import { watchRemote } from './remote';
import { labScenes } from './scenes';
import { Toolbar } from './Toolbar';

type LabWindow = { __chatLabScenes?: { id: string; title: string }[] };

function applySettings() {
  const params = readParams();
  useSettingsStore.setState({
    sendErrorReports: false,
    scheme: params.scheme ?? 'dark',
    perfMode: params.perf ?? 'beauty',
    perfModeUserSet: true,
    language: params.lang ?? 'ru',
  });
  useNewsStore.setState({ dismissed: NEWS.map((item) => item.id) });
  if (params.motion) forceReducedMotion();
}

function mountToolbar() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<Toolbar />);
}

async function ipcTaken(): Promise<boolean> {
  return (await invoke<string>('lab_probe').catch(() => null)) === 'lab';
}

export async function bootChatLab() {
  if (inAppWindow() && !(await ipcTaken())) {
    document.body.textContent = 'chat lab: the app IPC is not mocked, the lab stops here';
    reportScene('the app IPC is not mocked');
    return;
  }
  (window as LabWindow).__chatLabScenes = labScenes.map(({ id, title }) => ({ id, title }));
  applySettings();
  watchRemote();
  const params = readParams();
  const scene = labScenes.find(
    (s) => s.id === (params.scene ?? (inAppWindow() ? '' : labScenes[0]?.id)),
  );
  const { kit, steps } = createKit();
  if (scene) {
    window.history.replaceState(null, '', `${scene.route}${window.location.search}`);
    await scene.setup?.(kit);
  }
  if (params.chrome) mountToolbar();
  void runScene(steps);
}
