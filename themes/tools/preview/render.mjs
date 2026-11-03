import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  inspectThemeCss,
  rewriteThemeAssetUrls,
} from '../../../desktop/src/lib/themes/css-guard.ts';
import { THEME_LIMITS } from '../../../desktop/src/lib/themes/rules.ts';
import { git } from '../git.mjs';
import { print } from '../summary.mjs';
import { listThemes } from '../theme.mjs';
import { launchChrome } from './chrome.mjs';
import { api, player } from './fixtures.mjs';
import { startServer } from './server.mjs';

const WIDTH = 1280;
const HEIGHT = 800;
const QUALITIES = [80, 70, 60, 50];
const READY_TIMEOUT_MS = 60_000;
const SETTLE_MS = 2500;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const MIME = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
};

const READY = `(() => {
  const images = [...document.querySelectorAll('[data-ui="main"] img, [data-ui="player"] img')].filter((img) => {
    const box = img.getBoundingClientRect();
    return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
  });
  return document.fonts.status === 'loaded' && images.length > 1 && images.every((img) => img.complete);
})()`;
const SCROLL = `document.querySelector('[data-ui="main"]').scrollTo({ top: 240, behavior: 'instant' })`;
const STATE = `({ fonts: document.fonts.status, images: document.querySelectorAll('[data-ui="main"] img').length, text: document.body.innerText.slice(0, 120) })`;
const FINISH = `(async () => {
  document.head.appendChild(window.__SC_PREVIEW_STYLE__);
  for (const animation of document.getAnimations()) {
    if (animation.playState !== 'finished') continue;
    try {
      animation.commitStyles();
      animation.cancel();
    } catch {}
  }
  await document.fonts.ready;
  return [...window.__SC_PREVIEW_UNKNOWN__, ...window.__SC_PREVIEW_REQUESTS__];
})()`;

const { values, positionals } = parseArgs({
  options: {
    dist: { type: 'string' },
    chrome: { type: 'string' },
    out: { type: 'string' },
    since: { type: 'string' },
    count: { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const root = resolve(import.meta.dirname, '..', '..', '..');
const desktop = join(root, 'desktop');
const appVersion = JSON.parse(
  readFileSync(join(desktop, 'src-tauri', 'tauri.conf.json'), 'utf8'),
).version;
const constants = readFileSync(join(desktop, 'src', 'lib', 'constants.ts'), 'utf8');
const news = constants.slice(constants.indexOf('export const NEWS'));
const newsIds = [...news.slice(0, news.indexOf('];')).matchAll(/\bid: '([^']+)'/g)].map(
  (match) => match[1],
);

async function evaluate(browser, sessionId, expression) {
  const result = await browser.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

const changed = values.since
  ? new Set(
      git(root, ['diff', '--name-only', `${values.since}...HEAD`, '--', 'themes'])
        .split('\n')
        .map((path) => path.split('/')[1]),
    )
  : null;
const dirs =
  positionals.length > 0
    ? positionals.map((dir) => resolve(dir))
    : listThemes(root)
        .filter((id) => !changed || changed.has(id))
        .map((id) => join(root, 'themes', id));

if (values.count) {
  console.log(dirs.length);
  process.exit(0);
}
if (!values.dist) {
  console.error(
    'usage: render.mjs --dist <vite build> [--chrome <bin>] [--out <dir>] [--since <git-ref>] [theme dir...]',
  );
  process.exit(1);
}

const payloads = new Map();
let failed = 0;
for (const dir of dirs) {
  const id = basename(dir);
  try {
    const meta = JSON.parse(readFileSync(join(dir, 'theme.json'), 'utf8'));
    const assetsDir = join(dir, 'assets');
    const assets = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
    const source = readFileSync(join(dir, 'theme.css'), 'utf8');
    const report = inspectThemeCss(source, assets);
    if (report.errors.length > 0) {
      const first = report.errors[0];
      throw new Error(`theme.css:${first.line}:${first.column} ${first.code} ${first.message}`);
    }
    const css = rewriteThemeAssetUrls(source, (name) => {
      const type = MIME[name.slice(name.lastIndexOf('.') + 1)];
      return `data:${type};base64,${readFileSync(join(assetsDir, name)).toString('base64')}`;
    });
    const scheme = meta.scheme ?? 'dark';
    const settings = {
      scheme,
      accentColor: meta.accent ?? '#ff5500',
      bgPrimary: meta.background ?? '#08080a',
      interfaceFont: meta.font ?? 'inter',
      themePreset: 'custom',
      startupPage: 'home',
      language: 'en',
      perfMode: 'beauty',
      perfModeUserSet: true,
      perfProbed: true,
    };
    const background =
      scheme === 'white' && meta.background
        ? `:root { --bg-primary: ${meta.background} !important; }\n`
        : '';
    payloads.set(id, {
      css: background + css,
      api,
      appVersion,
      files: {
        'sc-settings.json': JSON.stringify({ state: settings, version: 0 }),
        'sc-player.json': JSON.stringify(player),
        'news.json': JSON.stringify({ state: { dismissed: newsIds }, version: 1 }),
      },
    });
  } catch (error) {
    failed++;
    print(`${id}: ${error.message}`);
  }
}

const server = await startServer(resolve(values.dist), payloads);
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
for (const payload of payloads.values()) payload.port = port;
const playwright = existsSync('/ms-playwright')
  ? readdirSync('/ms-playwright').find((name) => /^chromium-\d+$/.test(name))
  : undefined;
const browser = await launchChrome(
  values.chrome ??
    process.env.CHROME_BIN ??
    (playwright ? `/ms-playwright/${playwright}/chrome-linux/chrome` : 'google-chrome'),
);

try {
  for (const dir of dirs) {
    const id = basename(dir);
    if (!payloads.has(id)) continue;
    let targetId;
    try {
      ({ targetId } = await browser.send('Target.createTarget', { url: 'about:blank' }));
      const { sessionId } = await browser.send('Target.attachToTarget', {
        targetId,
        flatten: true,
      });
      browser.listeners.add((message) => {
        if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = message.params;
        const url = new URL(request.url);
        const local =
          url.protocol === 'data:' ||
          url.protocol === 'blob:' ||
          (url.protocol === 'http:' &&
            url.port === String(port) &&
            (url.hostname === '127.0.0.1' || /^scproxy-\d+\.localhost$/.test(url.hostname)));
        const method = local ? 'Fetch.continueRequest' : 'Fetch.failRequest';
        const params = local ? { requestId } : { requestId, errorReason: 'BlockedByClient' };
        browser.send(method, params, sessionId).catch(() => {});
      });
      await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, sessionId);
      await browser.send(
        'Emulation.setDeviceMetricsOverride',
        { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
      await browser.send(
        'Emulation.setUserAgentOverride',
        { userAgent: USER_AGENT, platform: 'Linux x86_64' },
        sessionId,
      );
      await browser.send('Page.enable', {}, sessionId);
      await browser.send('Page.navigate', { url: `${origin}/home?theme=${id}` }, sessionId);

      const deadline = Date.now() + READY_TIMEOUT_MS;
      const waitReady = async () => {
        while (!(await evaluate(browser, sessionId, READY).catch(() => false))) {
          if (Date.now() > deadline) {
            const state = await evaluate(browser, sessionId, STATE);
            throw new Error(`the app did not render the home page: ${JSON.stringify(state)}`);
          }
          await sleep(250);
        }
      };
      await waitReady();
      await evaluate(browser, sessionId, SCROLL);
      await waitReady();
      await sleep(SETTLE_MS);
      const calls = await evaluate(browser, sessionId, FINISH);
      if (values.verbose) {
        console.log(`${id}: unanswered commands and api calls\n${calls.join('\n')}`);
      }

      let bytes = null;
      for (const quality of QUALITIES) {
        const shot = await browser.send(
          'Page.captureScreenshot',
          { format: 'webp', quality, captureBeyondViewport: false },
          sessionId,
        );
        bytes = Buffer.from(shot.data, 'base64');
        if (bytes.length <= THEME_LIMITS.previewBytes) break;
      }
      if (bytes.length > THEME_LIMITS.previewBytes) throw new Error('preview stays over 256 KiB');

      const folder = values.out ? join(resolve(values.out), id) : dir;
      mkdirSync(folder, { recursive: true });
      const target = join(folder, 'preview.webp');
      writeFileSync(target, bytes);
      print(`${id}: ${target} ${(bytes.length / 1024).toFixed(1)} KiB`);
    } catch (error) {
      failed++;
      print(`${id}: ${error.message}`);
    } finally {
      if (targetId) await browser.send('Target.closeTarget', { targetId }).catch(() => {});
    }
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed > 0 ? 1 : 0);
