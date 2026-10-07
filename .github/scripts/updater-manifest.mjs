import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repository = process.env.GITHUB_REPOSITORY || 'zxcloli666/SoundCloud-Desktop';
const downloadBase = `https://github.com/${repository}/releases/latest/download`;

const TARGETS = [
  { pattern: /_x64-setup\.exe$/, keys: ['windows-x86_64', 'windows-x86_64-nsis'] },
  { pattern: /_x64_[\w-]+\.msi$/, keys: ['windows-x86_64-msi'] },
  { pattern: /_amd64\.AppImage$/, keys: ['linux-x86_64', 'linux-x86_64-appimage'] },
  { pattern: /_aarch64\.AppImage$/, keys: ['linux-aarch64', 'linux-aarch64-appimage'] },
  { pattern: /_arm64\.app\.tar\.gz$/, keys: ['darwin-aarch64', 'darwin-aarch64-app'] },
  { pattern: /_x64\.app\.tar\.gz$/, keys: ['darwin-x86_64', 'darwin-x86_64-app'] },
];

function writeConfig(out) {
  const pubkey = process.env.TAURI_UPDATER_PUBKEY?.trim();
  if (!pubkey) throw new Error('TAURI_UPDATER_PUBKEY is empty');
  const config = {
    bundle: { createUpdaterArtifacts: true },
    plugins: { updater: { pubkey, endpoints: [`${downloadBase}/latest.json`] } },
  };
  writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
}

function writeManifest(dir, version) {
  const files = readdirSync(dir);
  const platforms = {};
  for (const file of files) {
    const target = TARGETS.find((t) => t.pattern.test(file));
    const sigPath = join(dir, `${file}.sig`);
    if (!target || !existsSync(sigPath)) continue;
    const entry = {
      signature: readFileSync(sigPath, 'utf8').trim(),
      url: `${downloadBase}/${encodeURIComponent(file)}`,
    };
    for (const key of target.keys) platforms[key] = entry;
  }
  if (Object.keys(platforms).length === 0) {
    console.log('No signed updater artifacts found, skipping latest.json');
    return;
  }
  const manifest = {
    version: version.replace(/^v/, ''),
    pub_date: new Date().toISOString(),
    platforms,
  };
  writeFileSync(join(dir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`latest.json: ${Object.keys(platforms).sort().join(', ')}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'config' && args.length === 1) {
  writeConfig(args[0]);
} else if (command === 'manifest' && args.length === 2) {
  writeManifest(args[0], args[1]);
} else {
  console.error('usage: updater-manifest.mjs config <out.json> | manifest <dir> <version>');
  process.exit(1);
}
