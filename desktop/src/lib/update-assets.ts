import type { GithubAsset } from './update-check';
import type { InstallKind, UpdaterInfo } from './updater';

const HINT_KEYS: Record<InstallKind, string> = {
  nsis: 'update.hintInstaller',
  msi: 'update.hintInstaller',
  portable: 'update.hintPortable',
  macApp: 'update.hintMac',
  appImage: 'update.hintAppImage',
  deb: 'update.hintDeb',
  rpm: 'update.hintRpm',
  aur: 'update.hintAur',
  flatpak: 'update.hintFlatpak',
  source: 'update.hintSource',
};

function isArm(arch: string) {
  return arch === 'aarch64' || arch === 'arm64';
}

function assetPattern(info: UpdaterInfo): RegExp | null {
  const arm = isArm(info.arch);
  switch (info.kind) {
    case 'portable':
      return /-portable\.exe$/i;
    case 'msi':
      return /_x64_[\w-]+\.msi$/i;
    case 'nsis':
      return /_x64-setup\.exe$/i;
    case 'macApp':
      return arm ? /_aarch64\.dmg$/i : /_x64\.dmg$/i;
    case 'appImage':
      return arm ? /_aarch64\.AppImage$/i : /_amd64\.AppImage$/i;
    case 'deb':
      return arm ? /_arm64\.deb$/i : /_amd64\.deb$/i;
    case 'rpm':
      return arm ? /\.aarch64\.rpm$/i : /\.x86_64\.rpm$/i;
    case 'flatpak':
      return /\.flatpak$/i;
    case 'aur':
      return null;
    case 'source':
      if (info.os === 'windows') return /_x64-setup\.exe$/i;
      if (info.os === 'macos') return arm ? /_aarch64\.dmg$/i : /_x64\.dmg$/i;
      return null;
  }
}

export function manualHintKey(info: UpdaterInfo): string {
  if (info.kind === 'source' && info.os === 'windows') return HINT_KEYS.nsis;
  if (info.kind === 'source' && info.os === 'macos') return HINT_KEYS.macApp;
  return HINT_KEYS[info.kind];
}

export function pickReleaseAsset(
  assets: readonly GithubAsset[] | undefined,
  info: UpdaterInfo,
): GithubAsset | null {
  const pattern = assetPattern(info);
  if (!pattern || !assets) return null;
  return assets.find((asset) => pattern.test(asset.name)) ?? null;
}
