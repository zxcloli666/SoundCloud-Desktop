import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { inspectSvg, inspectThemeCss } from '../../desktop/src/lib/themes/css-guard.ts';
import {
  compareVersions,
  GITHUB_LOGIN,
  HEX_COLOR,
  imageSize,
  isCleanText,
  SEMVER,
  SHA256,
  sniffAssetType,
  TEXT_LIMITS,
  THEME_ASSET_NAME,
  THEME_FONTS,
  THEME_ID,
  THEME_LANGS,
  THEME_LICENSES,
  THEME_LIMITS,
  THEME_PREVIEW_PATHS,
  THEME_RESERVED_IDS,
} from '../../desktop/src/lib/themes/rules.ts';
import { commitTime, tryGit } from './git.mjs';

const THEME_KEYS = [
  '$schema',
  'id',
  'name',
  'description',
  'version',
  'author',
  'license',
  'minApp',
  'accent',
  'background',
  'font',
];
const AUTHOR_KEYS = ['name', 'github'];
const REVOKED_KEYS = ['id', 'hash', 'reason'];
const OS_FILES = ['.DS_Store', 'Thumbs.db', 'desktop.ini'];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value, max) => typeof value === 'string' && isCleanText(value, max);
const isVersion = (value) => typeof value === 'string' && SEMVER.test(value);
const decodeUtf8 = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const listFiles = (dir) =>
  readdirSync(dir)
    .filter((name) => !OS_FILES.includes(name))
    .sort();

export function listThemes(root) {
  return readdirSync(join(root, 'themes'), { withFileTypes: true })
    .filter((item) => item.isDirectory() && item.name !== 'tools')
    .map((item) => item.name)
    .sort();
}

export function readRevoked(root) {
  try {
    const list = JSON.parse(readFileSync(join(root, 'themes', 'revoked.json'), 'utf8'));
    const valid =
      Array.isArray(list) &&
      list.every(
        (item) =>
          isObject(item) &&
          Object.keys(item).every((key) => REVOKED_KEYS.includes(key)) &&
          typeof item.id === 'string' &&
          THEME_ID.test(item.id) &&
          typeof item.hash === 'string' &&
          SHA256.test(item.hash) &&
          typeof item.reason === 'string',
      );
    return valid ? list : null;
  } catch {
    return null;
  }
}

export function loadTheme(dir, buildRev, previousEntry) {
  const folder = basename(dir);
  const at = `themes/${folder}`;
  const errors = [];
  const warnings = [];
  const failed = () => ({ entry: null, errors, warnings });

  const names = listFiles(dir);
  const previews = [];
  const assetNames = [];
  for (const name of names) {
    const stat = lstatSync(join(dir, name));
    if (name === 'assets' && stat.isDirectory()) {
      for (const asset of listFiles(join(dir, name))) {
        const where = `${at}/assets/${asset}`;
        if (!lstatSync(join(dir, name, asset)).isFile()) {
          errors.push(`${where}: assets/ must hold only plain files`);
        } else if (!THEME_ASSET_NAME.test(asset)) {
          errors.push(`${where}: bad file name`);
        } else {
          assetNames.push(asset);
        }
      }
    } else if (!stat.isFile()) {
      errors.push(`${at}/${name}: only plain files and a flat assets/ are allowed`);
    } else if (THEME_PREVIEW_PATHS.includes(name)) {
      previews.push(name);
    } else if (name !== 'theme.json' && name !== 'theme.css') {
      errors.push(`${at}/${name}: unexpected file`);
    }
  }
  for (const required of ['theme.json', 'theme.css']) {
    if (!names.includes(required)) errors.push(`${at}/${required}: missing`);
  }
  if (previews.length !== 1) errors.push(`${at}: needs exactly one preview.webp or preview.png`);
  if (errors.length > 0) return failed();

  const bad = (field, rule) => errors.push(`${at}/theme.json: ${field} ${rule}`);
  let meta;
  try {
    meta = JSON.parse(decodeUtf8(readFileSync(join(dir, 'theme.json'))));
  } catch (error) {
    errors.push(`${at}/theme.json: cannot be read: ${error.message}`);
  }
  if (meta !== undefined && !isObject(meta)) bad('theme.json', 'must be an object');
  if (isObject(meta)) {
    for (const key of Object.keys(meta)) {
      if (!THEME_KEYS.includes(key)) bad(key, 'is not a known key');
    }
    if (typeof meta.id !== 'string' || !THEME_ID.test(meta.id)) {
      bad('id', 'must be 3-32 characters of a-z, 0-9 and -');
    } else if (THEME_RESERVED_IDS.includes(meta.id)) {
      bad('id', 'is reserved');
    }
    if (meta.id !== folder) bad('id', `must equal the folder name "${folder}"`);
    if (!isText(meta.name, TEXT_LIMITS.name)) {
      bad('name', `must be 1-${TEXT_LIMITS.name} plain characters`);
    }

    const { description, author } = meta;
    if (!isObject(description)) {
      bad('description', 'must be an object of languages');
    } else {
      const langs = Object.keys(description);
      if (langs.length < 1 || langs.length > THEME_LANGS.length) {
        bad('description', `needs 1-${THEME_LANGS.length} languages`);
      }
      for (const lang of langs) {
        if (!THEME_LANGS.includes(lang)) {
          bad(`description.${lang}`, 'is not a supported language');
        } else if (!isText(description[lang], TEXT_LIMITS.description)) {
          bad(`description.${lang}`, `must be 1-${TEXT_LIMITS.description} plain characters`);
        }
      }
    }

    if (!isVersion(meta.version)) bad('version', 'must look like 1.0.0');

    if (!isObject(author)) {
      bad('author', 'must be an object with a name');
    } else {
      for (const key of Object.keys(author)) {
        if (!AUTHOR_KEYS.includes(key)) bad(`author.${key}`, 'is not a known key');
      }
      if (!isText(author.name, TEXT_LIMITS.authorName)) {
        bad('author.name', `must be 1-${TEXT_LIMITS.authorName} plain characters`);
      }
      const github = author.github;
      if (github !== undefined && !(typeof github === 'string' && GITHUB_LOGIN.test(github))) {
        bad('author.github', 'must be a GitHub login');
      }
    }

    if (!THEME_LICENSES.includes(meta.license)) {
      bad('license', `must be one of ${THEME_LICENSES.join(', ')}`);
    }
    if (meta.minApp !== undefined && !isVersion(meta.minApp)) bad('minApp', 'must look like 1.0.0');
    for (const key of ['accent', 'background']) {
      const color = meta[key];
      if (color !== undefined && !(typeof color === 'string' && HEX_COLOR.test(color))) {
        bad(key, 'must look like #1a2b3c in lowercase');
      }
    }
    if (meta.font !== undefined && !THEME_FONTS.includes(meta.font)) {
      bad('font', `must be one of ${THEME_FONTS.join(', ')}`);
    }
    if (meta.$schema !== undefined && typeof meta.$schema !== 'string') {
      bad('$schema', 'must be a string');
    }
  }

  const cssBytes = readFileSync(join(dir, 'theme.css'));
  const css = { path: 'theme.css', sha256: sha256(cssBytes), size: cssBytes.length };
  let cssText = null;
  try {
    cssText = decodeUtf8(cssBytes);
  } catch {
    errors.push(`${at}/theme.css: is not valid UTF-8`);
  }
  const report = cssText === null ? null : inspectThemeCss(cssText, assetNames);
  const format = (issue) =>
    `${at}/theme.css:${issue.line}:${issue.column} ${issue.code} ${issue.message}`;
  errors.push(...(report?.errors ?? []).map(format));
  warnings.push(...(report?.warnings ?? []).map(format));
  const used = report?.assets ?? [];

  if (assetNames.length > THEME_LIMITS.assetsCount) {
    errors.push(`${at}/assets: more than ${THEME_LIMITS.assetsCount} files`);
  }
  let total = 0;
  const assets = [];
  for (const name of assetNames) {
    const path = `assets/${name}`;
    const where = `${at}/${path}`;
    const bytes = readFileSync(join(dir, path));
    total += bytes.length;
    if (bytes.length > THEME_LIMITS.assetBytes) errors.push(`${where}: bigger than 1 MiB`);
    const extension = name.slice(name.lastIndexOf('.') + 1);
    const expected = extension === 'jpg' ? 'jpeg' : extension;
    if (sniffAssetType(bytes) !== expected) {
      errors.push(`${where}: content is not ${expected}`);
    } else if (expected === 'svg') {
      let svg = null;
      try {
        svg = decodeUtf8(bytes);
      } catch {
        errors.push(`${where}: is not valid UTF-8`);
      }
      const svgReport = svg === null ? { errors: [], warnings: [] } : inspectSvg(svg);
      errors.push(...svgReport.errors.map((message) => `${where}: ${message}`));
      warnings.push(...svgReport.warnings.map((message) => `${where}: svg-text ${message}`));
    } else if (expected !== 'woff2') {
      const size = imageSize(bytes);
      if (!size) {
        errors.push(`${where}: cannot read the image size`);
      } else if (Math.max(size.width, size.height) > THEME_LIMITS.assetMaxSide) {
        errors.push(
          `${where}: ${size.width}x${size.height} is over ${THEME_LIMITS.assetMaxSide} px on a side`,
        );
      }
    }
    if (!used.includes(name)) errors.push(`${where}: not used in theme.css`);
    assets.push({ path, sha256: sha256(bytes), size: bytes.length });
  }
  if (total > THEME_LIMITS.assetsTotalBytes) errors.push(`${at}/assets: more than 3 MiB in total`);

  const previewPath = previews[0];
  const previewAt = `${at}/${previewPath}`;
  const previewBytes = readFileSync(join(dir, previewPath));
  const previewType = previewPath === 'preview.png' ? 'png' : 'webp';
  if (sniffAssetType(previewBytes) !== previewType) {
    errors.push(`${previewAt}: content is not ${previewType}`);
  }
  if (previewBytes.length > THEME_LIMITS.previewBytes) {
    errors.push(`${previewAt}: bigger than 256 KiB`);
  }
  const previewSize = imageSize(previewBytes);
  if (!previewSize) {
    errors.push(`${previewAt}: cannot read the image size`);
  } else {
    const { width, height } = previewSize;
    const { previewMinWidth, previewMaxWidth, previewMinAspect, previewMaxAspect } = THEME_LIMITS;
    if (width < previewMinWidth || width > previewMaxWidth) {
      errors.push(`${previewAt}: width ${width} is outside ${previewMinWidth}-${previewMaxWidth}`);
    }
    const aspect = width / height;
    if (!(aspect >= previewMinAspect && aspect <= previewMaxAspect)) {
      errors.push(
        `${previewAt}: ${width}x${height} is not ${previewMinAspect}-${previewMaxAspect} wide, 16:10 fits`,
      );
    }
  }
  if (errors.length > 0) return failed();

  const files = assets.map((a) => [a.path, a.sha256]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const key = [css.sha256, files, meta.accent ?? null, meta.background ?? null, meta.font ?? null];
  const hash = sha256(Buffer.from(JSON.stringify(key), 'utf8'));
  if (previousEntry && previousEntry.hash !== hash && isVersion(previousEntry.version)) {
    if (compareVersions(meta.version, previousEntry.version) <= 0) {
      errors.push(
        `${at}/theme.json: version must go up from ${previousEntry.version}, the files changed`,
      );
      return failed();
    }
  }

  const root = resolve(dir, '..', '..');
  let rev;
  if (buildRev) {
    rev = tryGit(root, ['log', '-1', '--format=%H', buildRev, '--', at]) || buildRev;
    const tree = tryGit(root, ['rev-parse', `${buildRev}:${at}`]);
    if (!tree || tryGit(root, ['rev-parse', `${rev}:${at}`]) !== tree) rev = buildRev;
  }

  const entry = {
    id: meta.id,
    rev,
    name: meta.name,
    description: Object.fromEntries(
      THEME_LANGS.filter((lang) => lang in meta.description).map((lang) => [
        lang,
        meta.description[lang],
      ]),
    ),
    version: meta.version,
    author: meta.author.github
      ? { name: meta.author.name, github: meta.author.github }
      : { name: meta.author.name },
    license: meta.license,
    minApp: meta.minApp,
    accent: meta.accent,
    background: meta.background,
    font: meta.font,
    updated: rev ? commitTime(root, rev) : undefined,
    hash,
    size: css.size + assets.reduce((sum, asset) => sum + asset.size, 0),
    preview: {
      path: previewPath,
      sha256: sha256(previewBytes),
      size: previewBytes.length,
      width: previewSize.width,
      height: previewSize.height,
    },
    css,
    assets,
  };
  return { entry, errors, warnings };
}
