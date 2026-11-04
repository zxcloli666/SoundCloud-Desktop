import ReactDOM from 'react-dom/client';
import { NEWS } from '../../../lib/constants';
import { useNewsStore } from '../../../stores/news';
import { useSettingsStore } from '../../../stores/settings';
import { isHybrid } from './ipc';
import { createKit } from './kit';
import { forceReducedMotion } from './motion';
import { readParams } from './params';
import { runScene } from './ready';
import { watchRemote } from './remote';
import { labScenes } from './scenes';
import { Toolbar } from './Toolbar';

type LabWindow = { __chatLabScenes?: { id: string; title: string }[] };

function applySettings() {
  const params = readParams();
  const plain = !isHybrid();
  useSettingsStore.setState({
    sendErrorReports: false,
    ...(params.scheme || plain ? { scheme: params.scheme ?? 'dark' } : {}),
    ...(params.perf || plain ? { perfMode: params.perf ?? 'beauty', perfModeUserSet: true } : {}),
    ...(params.lang || plain ? { language: params.lang ?? 'ru' } : {}),
  });
  if (plain) useNewsStore.setState({ dismissed: NEWS.map((item) => item.id) });
  if (params.motion) forceReducedMotion();
}

function mountToolbar() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<Toolbar />);
}

export async function bootChatLab() {
  (window as LabWindow).__chatLabScenes = labScenes.map(({ id, title }) => ({ id, title }));
  applySettings();
  watchRemote();
  const params = readParams();
  const scene = labScenes.find(
    (s) => s.id === (params.scene ?? (isHybrid() ? '' : labScenes[0]?.id)),
  );
  const { kit, steps } = createKit();
  if (scene) {
    window.history.replaceState(null, '', `${scene.route}${window.location.search}`);
    await scene.setup?.(kit);
  }
  if (params.chrome) mountToolbar();
  void runScene(steps);
}
