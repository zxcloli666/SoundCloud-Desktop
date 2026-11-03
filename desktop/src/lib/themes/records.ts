import { APP_VERSION } from '../constants';
import type { InstalledVersion } from './files';
import type { Catalog, CatalogTheme } from './index-parse.ts';
import { compareVersions } from './rules.ts';

export interface InstalledTheme extends InstalledVersion {
  pinned: boolean;
  installedAt: number;
  previous: InstalledVersion | null;
  brokenFor: string | null;
}

export interface ThemeTrial {
  id: string;
  version: InstalledVersion;
  until: number;
}

export interface LookState {
  installed: Record<string, InstalledTheme>;
  activeId: string | null;
  enabled: boolean;
  trial: ThemeTrial | null;
}

export function brokenKey(hash: string): string {
  return `${hash}@${APP_VERSION}`;
}

export function isBroken(theme: InstalledTheme | null | undefined, hash = theme?.hash): boolean {
  return !!theme && !!hash && theme.brokenFor === brokenKey(hash);
}

export function isRevoked(catalog: Catalog | null, id: string, hash: string): boolean {
  return !!catalog?.revoked.some((item) => item.id === id && item.hash === hash);
}

export function rollbackTarget(
  theme: InstalledTheme,
  catalog: Catalog | null,
  id: string,
): InstalledVersion | null {
  const { previous } = theme;
  if (!previous || isRevoked(catalog, id, previous.hash) || isBroken(theme, previous.hash)) {
    return null;
  }
  return previous;
}

export function hasUpdate(theme: InstalledTheme, entry: CatalogTheme): boolean {
  return (
    entry.compatible &&
    entry.hash !== theme.hash &&
    !isBroken(theme, entry.hash) &&
    compareVersions(entry.version, theme.version) > 0
  );
}

export function activeTheme(state: LookState): InstalledTheme | null {
  const theme = state.activeId ? state.installed[state.activeId] : undefined;
  return theme && state.enabled && !isBroken(theme) ? theme : null;
}

export function activeLook(state: LookState): InstalledVersion | null {
  return state.trial?.version ?? activeTheme(state);
}

export function versionOf(theme: InstalledVersion): InstalledVersion {
  const { version, hash, rev, name, accent, background, font, scheme, files } = theme;
  return { version, hash, rev, name, accent, background, font, scheme, files };
}

export function withVersion(
  version: InstalledVersion,
  current: InstalledTheme | undefined,
): InstalledTheme {
  if (current?.hash === version.hash) return { ...current, ...versionOf(version) };
  return {
    ...versionOf(version),
    pinned: current?.pinned ?? false,
    installedAt: Date.now(),
    previous: current ? versionOf(current) : null,
    brokenFor: current?.brokenFor ?? null,
  };
}

export function rolledBack(
  theme: InstalledTheme,
  previous: InstalledVersion,
  pinned: boolean,
): InstalledTheme {
  return {
    ...versionOf(previous),
    pinned,
    installedAt: theme.installedAt,
    previous: versionOf(theme),
    brokenFor: theme.brokenFor,
  };
}
