import type { TFunction } from 'i18next';
import { isMac, isWindows } from '../platform';
import type { DnsAnswer, EnvInfo, Fail, PhaseProbe, TargetCheck, Tone, Verdict } from './check';

export type Os = 'windows' | 'mac' | 'linux';
export type Column = (typeof COLUMNS)[number];

export interface ManualStep {
  text: string;
  action: 'copy' | 'open';
}

export const COLUMNS = ['dns', 'tcp', 'tls', 'http'] as const;
export const HEALTH_HOST = 'api.scnative.space';
export const EXCLUDED_DOMAINS = ['scnative.space', 'soundcloud-desktop.fun'] as const;

const HEALTH_URL = `https://${HEALTH_HOST}/health`;
const NSLOOKUP = `nslookup ${HEALTH_HOST}; nslookup ${HEALTH_HOST} 1.1.1.1`;
const MANUAL: ReadonlySet<Verdict> = new Set([
  'dns',
  'dnsFailed',
  'reset',
  'timeout',
  'cert',
  'offline',
  'unknown',
]);
const TIMESTAMPS_OFF: ReadonlySet<string> = new Set(['disabled', 'allowed', 'default']);
const SHOWN_ADDRS = 2;
const PHASE_BUDGET_MS = 5_000;
const CLOCK: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const DATED: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', ...CLOCK };

export function currentOs(): Os {
  if (isWindows()) return 'windows';
  if (isMac()) return 'mac';
  return 'linux';
}

export function showManual(verdict: Verdict): boolean {
  return MANUAL.has(verdict);
}

export function manualSteps(os: Os): ManualStep[] {
  const curl = os === 'windows' ? 'curl.exe' : 'curl';
  return [
    { text: `${curl} -v -m 15 ${HEALTH_URL}`, action: 'copy' },
    { text: NSLOOKUP, action: 'copy' },
    { text: HEALTH_URL, action: 'open' },
  ];
}

export function checkedTime(atMs: number, language: string, now = Date.now()): string {
  const at = new Date(atMs);
  const today = at.toDateString() === new Date(now).toDateString();
  return at.toLocaleString(language, today ? CLOCK : DATED);
}

export function fixCommand(os: Os): string | null {
  if (os === 'windows') return 'netsh interface tcp set global timestamps=enabled';
  if (os === 'linux') return 'sudo sysctl -w net.ipv4.tcp_timestamps=1';
  return null;
}

export function timestampsOff(env: EnvInfo, targets: TargetCheck[]): boolean {
  const seen = targets
    .flatMap((target) => [target.probe, target.dohProbe])
    .map((probe) => probe?.tcpTimestamps ?? null);
  if (seen.includes(true)) return false;
  const configured = env.tcpTimestamps !== null && TIMESTAMPS_OFF.has(env.tcpTimestamps);
  return configured || seen.includes(false);
}

function addrs(answer: DnsAnswer | null): string {
  return answer?.addrs.slice(0, SHOWN_ADDRS).join(', ') ?? '';
}

function seconds(ms: number | null): number {
  return Math.max(1, Math.round((ms ?? PHASE_BUDGET_MS) / 1000));
}

function dnsDetail(t: TFunction, target: TargetCheck): string {
  const doh = addrs(target.doh);
  switch (target.dns) {
    case 'sane':
      return addrs(target.system) || t('netCheck.detail.skip');
    case 'spoofed':
      return t('netCheck.detail.dnsMismatch', { system: addrs(target.system), doh });
    case 'garbage':
      return target.system.addrs.length > 0
        ? t('netCheck.detail.dnsBogus', { ip: target.system.addrs[0] })
        : t('netCheck.detail.dnsMismatch', { system: t('netCheck.detail.dnsFail'), doh });
    case 'failed':
      return t('netCheck.detail.dnsFail');
    case 'unchecked':
      return t(target.proxied ? 'netCheck.detail.proxy' : 'netCheck.detail.skip');
  }
}

function failDetail(t: TFunction, fail: Fail, issuer: string | null, spentMs: number | null) {
  const ms = fail.afterMs ?? spentMs;
  switch (fail.kind) {
    case 'reset':
      return ms === null ? t('netCheck.detail.resetPlain') : t('netCheck.detail.reset', { ms });
    case 'closed':
      return ms === null ? t('netCheck.detail.closedPlain') : t('netCheck.detail.closed', { ms });
    case 'timeout':
      return t('netCheck.detail.timeout', { s: seconds(ms) });
    case 'refused':
      return t('netCheck.detail.refused');
    case 'unreachable':
      return t('netCheck.detail.unreachable');
    case 'tlsCert':
      return issuer ? t('netCheck.detail.cert', { issuer }) : t('netCheck.detail.certPlain');
    case 'tls':
      return t('netCheck.detail.tls');
    case 'dns':
    case 'dnsBogus':
      return t('netCheck.detail.dnsFail');
    default:
      return t('netCheck.detail.other');
  }
}

function probeFail(t: TFunction, probe: PhaseProbe | null): string | null {
  return probe?.fail ? failDetail(t, probe.fail, probe.certIssuer, null) : null;
}

function phaseDetail(t: TFunction, col: 'tcp' | 'tls', probe: PhaseProbe | null): string {
  const ms = col === 'tcp' ? probe?.tcpMs : probe?.tlsMs;
  if (ms != null) return t('netCheck.detail.ms', { ms });
  return probeFail(t, probe) ?? t('netCheck.detail.other');
}

function httpOk(t: TFunction, target: TargetCheck): string {
  const ms = target.probe?.firstByteMs ?? target.app?.ms;
  return ms != null ? t('netCheck.detail.ms', { ms }) : t('netCheck.detail.other');
}

function httpFailed(t: TFunction, target: TargetCheck): string {
  const { probe, app } = target;
  const fromProbe = probeFail(t, probe);
  if (fromProbe) return fromProbe;
  if (app?.fail) return failDetail(t, app.fail, probe?.certIssuer ?? null, app.ms);
  if (app?.status != null) return t('netCheck.detail.status', { status: app.status });
  return t('netCheck.detail.other');
}

function httpDetail(t: TFunction, tone: Tone, target: TargetCheck): string {
  if (tone === 'ok') return httpOk(t, target);
  if (tone === 'fail') return httpFailed(t, target);
  const status = target.probe?.status;
  if (status != null && status >= 500) return t('netCheck.detail.status', { status });
  return t('netCheck.detail.appFailed');
}

function detail(t: TFunction, col: Column, tone: Tone, target: TargetCheck): string {
  if (col === 'dns') return dnsDetail(t, target);
  if (tone === 'skip') {
    const proxied = target.proxied && col !== 'http';
    return t(proxied ? 'netCheck.detail.proxy' : 'netCheck.detail.skip');
  }
  if (col === 'http') return httpDetail(t, tone, target);
  return phaseDetail(t, col, target.probe);
}

export function cellTitle(t: TFunction, col: Column, target: TargetCheck): string {
  const label = t(`netCheck.col.${col}`);
  const tone = target.cells[COLUMNS.indexOf(col)];
  return tone === 'pending' ? label : `${label}: ${detail(t, col, tone, target)}`;
}
