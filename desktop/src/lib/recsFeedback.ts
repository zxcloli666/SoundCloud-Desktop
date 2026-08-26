import { createContext, useContext } from 'react';
import { recordLocalClusterFeedback } from '../stores/recommendation-taste';
import { api } from './api';
import { SEND_BEHAVIORAL_DATA } from './constants';

interface TrackClusterAttribution {
  cluster: string;
  expiresAt: number;
}

const trackToCluster = new Map<string, TrackClusterAttribution>();
const TRACK_CLUSTER_CAP = 500;
const TRACK_CLUSTER_TTL_MS = 2 * 60 * 60_000;

function pruneExpiredAttributions(now: number): void {
  for (const [urn, attribution] of trackToCluster) {
    if (attribution.expiresAt <= now) trackToCluster.delete(urn);
  }
}

export function setUrnCluster(urn: string, cluster: string): void {
  if (!urn || !cluster) return;
  const now = Date.now();
  pruneExpiredAttributions(now);
  if (trackToCluster.has(urn)) trackToCluster.delete(urn);
  trackToCluster.set(urn, { cluster, expiresAt: now + TRACK_CLUSTER_TTL_MS });
  while (trackToCluster.size > TRACK_CLUSTER_CAP) {
    const oldest = trackToCluster.keys().next().value;
    if (typeof oldest !== 'string') break;
    trackToCluster.delete(oldest);
  }
}

export function getUrnCluster(urn: string): string | undefined {
  const attribution = trackToCluster.get(urn);
  if (!attribution) return undefined;
  if (attribution.expiresAt <= Date.now()) {
    trackToCluster.delete(urn);
    return undefined;
  }
  return attribution.cluster;
}

/** Consume attribution after completion so a later unrelated play cannot reuse it. */
export function takeUrnCluster(urn: string): string | undefined {
  const cluster = getUrnCluster(urn);
  trackToCluster.delete(urn);
  return cluster;
}

export function clearUrnCluster(urn: string): void {
  trackToCluster.delete(urn);
}

export function recordClusterFeedback(cluster: string, type: 'click' | 'complete'): void {
  if (!cluster) return;
  recordLocalClusterFeedback(cluster, type);
  if (!SEND_BEHAVIORAL_DATA) return;
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
