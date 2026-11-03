import i18n from '../i18n';
import { useAuthStore } from '../stores/auth';
import { useReleasesSeen } from '../stores/releases-seen';
import { announcement, unseen } from './new-releases';
import { fetchReleases, RELEASES_CHECK_MS } from './new-releases-api';
import { notifyOs } from './notify';

const FIRST_CHECK_MS = 60_000;
const OPEN_WINDOW_MS = 5 * 60_000;

let notifiedAt = 0;

async function checkOnce(): Promise<void> {
  const owner = useAuthStore.getState().user?.urn;
  if (!owner) return;
  const releases = await fetchReleases();
  const urns = releases.map((r) => r.track.urn);
  const seen = useReleasesSeen.getState();
  if (seen.owner !== owner) {
    seen.rebase(owner, urns);
    return;
  }
  const fresh = unseen(releases, new Set(seen.urns));
  if (fresh.length === 0) return;
  seen.add(urns);
  if (document.hasFocus()) return;
  const { count, artists, more } = announcement(fresh);
  const names = artists.join(', ') + (more ? '...' : '');
  const sent = await notifyOs(
    i18n.t('releases.title'),
    i18n.t('releases.notifyBody', { count, artists: names }),
  );
  if (sent) notifiedAt = Date.now();
}

function check() {
  void checkOnce().catch(() => {});
}

export function startReleaseWatch(open: () => void): () => void {
  const first = setTimeout(check, FIRST_CHECK_MS);
  const timer = setInterval(check, RELEASES_CHECK_MS);
  const onFocus = () => {
    if (!notifiedAt || Date.now() - notifiedAt > OPEN_WINDOW_MS) return;
    notifiedAt = 0;
    open();
  };
  window.addEventListener('focus', onFocus);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    window.removeEventListener('focus', onFocus);
  };
}
