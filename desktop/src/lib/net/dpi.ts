import type { EnvInfo } from './check';
import type { Os } from './manual';

export type DpiKind = 'flowseal' | 'zapret' | 'goodbyedpi' | 'other';

export interface ExcludeList {
  file: string | null;
  lines: string[];
}

export interface DpiAdvice {
  name: string;
  kind: DpiKind;
  lists: ExcludeList[];
  apply: string | null;
}

export const EXCLUDED_DOMAINS = ['scnative.space', 'soundcloud-desktop.fun'] as const;

const FLOWSEAL: ReadonlySet<string> = new Set([
  'winws',
  'winws2',
  'zapret',
  'winws1',
  'discordfix_zapret',
]);
const ZAPRET: ReadonlySet<string> = new Set(['nfqws', 'nfqws2', 'tpws', 'dvtws']);
const GOODBYEDPI = 'goodbyedpi';
const ZAPRET_DIR = /^(\/opt\/zapret2?)\/config$/;
const SERVICE_DISABLED = 4;
const DRIVER_PREFIX = 'WinDivert';
const FALLBACK_NAME = 'zapret';

function kindOf(name: string, os: Os): DpiKind {
  if (name.toLowerCase() === GOODBYEDPI) return 'goodbyedpi';
  if (os === 'windows') return FLOWSEAL.has(name) ? 'flowseal' : 'other';
  return ZAPRET.has(name) ? 'zapret' : 'other';
}

function toolNames(env: EnvInfo | null): string[] {
  if (!env) return [];
  if (env.dpi.length > 0) return env.dpi.map((tool) => tool.name);
  return env.services
    .filter((service) => service.start !== SERVICE_DISABLED)
    .map((service) => service.name)
    .filter((name) => !name.startsWith(DRIVER_PREFIX));
}

function zapretDir(env: EnvInfo | null, name: string): string {
  const configured = env?.zapretConfig?.path.match(ZAPRET_DIR)?.[1];
  return configured ?? (name === 'nfqws2' ? '/opt/zapret2' : '/opt/zapret');
}

export function dpiAdvice(env: EnvInfo | null, addrs: string[], os: Os): DpiAdvice {
  const names = toolNames(env);
  const name = names.find((tool) => kindOf(tool, os) !== 'other') ?? names[0] ?? FALLBACK_NAME;
  const kind = kindOf(name, os);
  const domains = [...EXCLUDED_DOMAINS];
  if (kind === 'flowseal') {
    const lists: ExcludeList[] = [{ file: 'lists/list-exclude-user.txt', lines: domains }];
    if (addrs.length > 0) lists.push({ file: 'lists/ipset-exclude-user.txt', lines: addrs });
    return { name, kind, lists, apply: null };
  }
  if (kind === 'zapret') {
    const dir = zapretDir(env, name);
    return {
      name,
      kind,
      lists: [
        { file: `${dir}/ipset/zapret-hosts-user-exclude.txt`, lines: [...domains, ...addrs] },
      ],
      apply: `sudo ${dir}/ipset/get_exclude.sh`,
    };
  }
  if (kind === 'goodbyedpi') return { name, kind, lists: [], apply: null };
  return { name, kind, lists: [{ file: null, lines: domains }], apply: null };
}

export function excludeList(advice: DpiAdvice): string | null {
  return advice.lists[0]?.file ?? null;
}

export function bypassList(advice: DpiAdvice, env: EnvInfo | null): string | null {
  if (advice.kind === 'flowseal') return 'lists/list-general-user.txt';
  if (advice.kind === 'zapret') return `${zapretDir(env, advice.name)}/ipset/zapret-hosts-user.txt`;
  return null;
}

export function shownName(advice: DpiAdvice): string {
  return advice.kind === 'flowseal' || advice.kind === 'zapret' ? FALLBACK_NAME : advice.name;
}
