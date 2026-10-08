import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { trackedInvoke as invoke } from '../diagnostics';
import type { Tier } from '../edge';

export type Verdict =
  | 'checking'
  | 'ok'
  | 'backupDown'
  | 'partial'
  | 'relayOnly'
  | 'dns'
  | 'dnsFailed'
  | 'reset'
  | 'timeout'
  | 'cert'
  | 'down'
  | 'offline'
  | 'unknown';
export type Hint = 'none' | 'zapret' | 'zapretTimestamps';
export type Remote = 'up' | 'down' | 'unknown';
export type Internet = 'online' | 'offline' | 'unknown';
export type Trigger = 'manual' | 'auto';
export type TargetId = 'main' | 'star' | 'storage' | 'images' | 'relay';
export type Tone = 'ok' | 'warn' | 'fail' | 'skip' | 'pending';
export type DnsState = 'sane' | 'garbage' | 'spoofed' | 'failed' | 'unchecked';
export type Role = 'primary' | 'failover' | 'hedge';
export type Phase = 'dns' | 'tcp' | 'tls' | 'firstByte';
export type FailKind =
  | 'dns'
  | 'dnsBogus'
  | 'timeout'
  | 'refused'
  | 'unreachable'
  | 'reset'
  | 'closed'
  | 'tlsCert'
  | 'tls'
  | 'status'
  | 'body'
  | 'other';

export interface Fail {
  kind: FailKind;
  phase: Phase | null;
  afterMs: number | null;
  detail: string | null;
}

export interface DnsAnswer {
  addrs: string[];
  ms: number | null;
  fail: Fail | null;
  provider: string | null;
}

export interface PhaseProbe {
  addr: string | null;
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  firstByteMs: number | null;
  status: number | null;
  fail: Fail | null;
  certIssuer: string | null;
  tcpTimestamps: boolean | null;
  synRetrans: number | null;
}

export interface AppProbe {
  ok: boolean;
  status: number | null;
  ms: number | null;
  fail: Fail | null;
}

export interface TargetCheck {
  id: TargetId;
  node: string | null;
  host: string;
  proxied: boolean;
  system: DnsAnswer;
  doh: DnsAnswer | null;
  dns: DnsState;
  probe: PhaseProbe | null;
  dohProbe: PhaseProbe | null;
  app: AppProbe | null;
  ok: boolean;
  cells: [Tone, Tone, Tone, Tone];
  totalMs: number | null;
}

export interface DohProbe {
  provider: string;
  ok: boolean;
  ms: number | null;
  fail: Fail | null;
}

export interface DpiTool {
  name: string;
  args: string | null;
}

export interface ServiceInfo {
  name: string;
  image: string | null;
  strategy: string | null;
  start: number | null;
}

export interface ZapretConfig {
  path: string;
  values: Record<string, string>;
}

export interface EnvInfo {
  dpi: DpiTool[];
  services: ServiceInfo[];
  tcpTimestamps: string | null;
  zapretConfig: ZapretConfig | null;
  units: string[];
  sandbox: string | null;
  proxy: boolean;
  envProxy: string[];
  vpn: string[];
  dnsServers: string[];
  notes: string[];
}

export interface EdgeSnapshot {
  pins: [string, number][];
  pool: string[];
}

export interface PathEvent {
  atMs: number;
  origin: string;
  tier: Tier;
  role: Role;
  ok: boolean;
  status: number | null;
  fail: FailKind | null;
  ms: number | null;
  source: string;
}

export interface AppInfo {
  version: string;
  os: string;
  arch: string;
  install: string;
}

export interface NetReport {
  version: number;
  atMs: number;
  trigger: Trigger;
  reason: string | null;
  durationMs: number;
  app: AppInfo;
  verdict: Verdict;
  hint: Hint;
  remote: Remote;
  internet: Internet;
  targets: TargetCheck[];
  doh: DohProbe[];
  env: EnvInfo | null;
  edge: EdgeSnapshot;
  recent: PathEvent[];
}

interface NetCheckUpdate {
  running: boolean;
  report: NetReport;
}

const UPDATE_EVENT = 'netcheck:update';
const STALE_MS = 2 * 60_000;
const RUN_WARN_MS = 60_000;

interface NetCheckState {
  open: boolean;
  running: boolean;
  failed: boolean;
  report: NetReport | null;
  openCheck: () => void;
  closeCheck: () => void;
  runCheck: () => Promise<void>;
}

let wired = false;

function settled(current: NetReport | null, update: NetCheckUpdate): boolean {
  return (
    update.running &&
    current !== null &&
    current.atMs === update.report.atMs &&
    current.verdict !== 'checking'
  );
}

export function watchNetCheck(): void {
  if (wired) return;
  wired = true;
  void listen<NetCheckUpdate>(UPDATE_EVENT, ({ payload }) => {
    if (settled(useNetCheckStore.getState().report, payload)) return;
    useNetCheckStore.setState({ running: payload.running, report: payload.report, failed: false });
  });
}

export async function loadLastReport(): Promise<void> {
  const last = await invoke<NetReport | null>('net_check_last').catch(() => null);
  const current = useNetCheckStore.getState().report;
  if (last && (!current || last.atMs > current.atMs)) useNetCheckStore.setState({ report: last });
}

export function isStale(report: NetReport | null, now = Date.now()): boolean {
  return report === null || now - report.atMs > STALE_MS;
}

export function shownVerdict(report: NetReport | null, running: boolean, failed: boolean): Verdict {
  if (running) return 'checking';
  if (report && report.verdict !== 'checking') return report.verdict;
  return failed ? 'unknown' : 'checking';
}

export const useNetCheckStore = create<NetCheckState>()((set, get) => ({
  open: false,
  running: false,
  failed: false,
  report: null,
  openCheck: () => {
    watchNetCheck();
    set({ open: true });
    void loadLastReport().then(() => {
      if (isStale(get().report)) void get().runCheck();
    });
  },
  closeCheck: () => set({ open: false }),
  runCheck: async () => {
    if (get().running) return;
    watchNetCheck();
    const before = get().report;
    set({ running: true, failed: false });
    try {
      const report = await invoke<NetReport>('net_check_run', undefined, RUN_WARN_MS);
      set({ report });
    } catch {
      const shown = get().report;
      set({ failed: true, report: shown?.verdict === 'checking' ? before : shown });
      void loadLastReport();
    } finally {
      set({ running: false });
    }
  },
}));

export function useShownVerdict(): Verdict {
  return useNetCheckStore((s) => shownVerdict(s.report, s.running, s.failed));
}

export function reportText(): Promise<string> {
  return invoke<string>('net_check_report_text');
}
