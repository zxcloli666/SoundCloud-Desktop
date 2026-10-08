import type { TFunction } from 'i18next';
import React from 'react';
import {
  AlertCircle,
  CircleCheck,
  Clock,
  Globe,
  Loader2,
  Lock,
  Radio,
  ShieldAlert,
  TriangleAlert,
  WifiOff,
} from '../../lib/icons';
import type { Verdict } from '../../lib/net/check';

const ICONS: Record<Verdict, { Icon: typeof Globe; tone: string }> = {
  checking: { Icon: Loader2, tone: 'animate-spin text-white/50' },
  ok: { Icon: CircleCheck, tone: 'text-emerald-300/80' },
  backupDown: { Icon: CircleCheck, tone: 'text-emerald-300/80' },
  partial: { Icon: TriangleAlert, tone: 'text-amber-300/80' },
  relayOnly: { Icon: Radio, tone: 'text-emerald-300/80' },
  dns: { Icon: Globe, tone: 'text-amber-300/80' },
  dnsFailed: { Icon: Globe, tone: 'text-rose-300/80' },
  reset: { Icon: ShieldAlert, tone: 'text-rose-300/80' },
  timeout: { Icon: Clock, tone: 'text-amber-300/80' },
  cert: { Icon: Lock, tone: 'text-rose-300/80' },
  down: { Icon: WifiOff, tone: 'text-white/60' },
  offline: { Icon: WifiOff, tone: 'text-sky-300/80' },
  unknown: { Icon: AlertCircle, tone: 'text-white/50' },
};

export function verdictTitle(t: TFunction, verdict: Verdict): string {
  return verdict === 'checking' ? t('netCheck.checking') : t(`netCheck.verdict.${verdict}.title`);
}

export const VerdictIcon = React.memo(({ verdict, size }: { verdict: Verdict; size: number }) => {
  const { Icon, tone } = ICONS[verdict];
  return <Icon size={size} className={`shrink-0 ${tone}`} />;
});
