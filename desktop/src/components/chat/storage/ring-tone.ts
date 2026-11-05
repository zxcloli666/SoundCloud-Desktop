const WARM_FROM = 0.7;

export function quotaShare(used: number, quota: number): number {
  if (quota <= 0) return used > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, used / quota));
}

export function quotaFull(used: number, quota: number): boolean {
  return quota > 0 && used >= quota;
}

export function ringTone(used: number, quota: number): string {
  if (quotaFull(used, quota)) return 'rgb(var(--bad))';
  const share = quotaShare(used, quota);
  if (share < WARM_FROM) return 'rgb(var(--mint))';
  const heat = Math.round(((share - WARM_FROM) / (1 - WARM_FROM)) * 85);
  return `color-mix(in oklch, rgb(var(--bad)) ${heat}%, rgb(var(--mint)))`;
}
