import { createContext, useContext } from 'react';
import { api } from './api';
import { SEND_BEHAVIORAL_DATA } from './constants';

const trackToCluster = new Map<string, string>();

export function setUrnCluster(urn: string, cluster: string): void {
  trackToCluster.set(urn, cluster);
}

export function getUrnCluster(urn: string): string | undefined {
  return trackToCluster.get(urn);
}

export function recordClusterFeedback(cluster: string, type: 'click' | 'complete'): void {
  if (!SEND_BEHAVIORAL_DATA) return;
  if (!cluster) return;
  api('/recommendations/feedback', {
    method: 'POST',
    body: JSON.stringify({ clusterId: cluster, type }),
  }).catch(() => {});
}

interface ClusterFeedbackCtx {
  clusterId: string;
}

const ClusterFeedbackContext = createContext<ClusterFeedbackCtx | null>(null);

export const ClusterFeedbackProvider = ClusterFeedbackContext.Provider;

export function useClusterFeedback(): string | null {
  const ctx = useContext(ClusterFeedbackContext);
  return ctx?.clusterId ?? null;
}
