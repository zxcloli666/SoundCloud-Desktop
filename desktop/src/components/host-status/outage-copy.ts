import type { RemoteVerdict } from '../../lib/host-status';

export type OutageCopy = 'reachable' | 'blocked' | 'allDown';

export function outageCopy(routeBlocked: boolean, remote: RemoteVerdict): OutageCopy {
  if (remote === 'up') return 'reachable';
  if (remote === 'down') return 'allDown';
  return routeBlocked ? 'blocked' : 'allDown';
}
