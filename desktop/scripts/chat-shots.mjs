import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const USAGE = `usage: node scripts/chat-shots.mjs [--url http://127.0.0.1:1420] [--out dir] [--scene a,b] [--scheme dark,white] [--perf beauty,medium,light] [--motion reduce] [--lang ru] [--size 1280x800] [--port 9333] [--timeout 30000] [--list]`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
const base = String(args.url ?? 'http://127.0.0.1:1420');
const out = resolve(String(args.out ?? 'chat-shots'));
const port = Number(args.port ?? 9333);
const timeout = Number(args.timeout ?? 30000);
const [width, height] = String(args.size ?? '1280x800')
  .split('x')
  .map(Number);
const list = (value, fallback) => (value ? String(value).split(',') : fallback);
const schemes = list(args.scheme, ['dark', 'white']);
const perfs = list(args.perf, ['beauty']);
const filter = list(args.scene, null);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitForBrowser() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error('browser did not start');
}

class Page {
  constructor(socket, id) {
    this.socket = socket;
    this.id = id;
    this.next = 1;
    this.pending = new Map();
    this.errors = [];
    socket.addEventListener('message', (event) => this.onMessage(JSON.parse(event.data)));
  }

  onMessage(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve: done, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else done(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      this.errors.push(message.params.exceptionDetails.exception?.description ?? 'exception');
    }
  }

  send(method, params = {}) {
    const id = this.next++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((done, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} got no answer in ${timeout} ms, the page is stuck`));
      }, timeout);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          done(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  async close() {
    this.socket.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${this.id}`).catch(() => null);
  }

  async value(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    return result.result.value;
  }
}

async function openPage() {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = await res.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const page = new Page(socket, target.id);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  return page;
}

function sceneUrl(scene, scheme, perf) {
  const q = new URLSearchParams({ 'chat-lab': '', chrome: '0', scheme, perf });
  if (scene) q.set('scene', scene);
  if (args.motion) q.set('motion', 'reduce');
  if (args.lang) q.set('lang', String(args.lang));
  return `${base}/?${q.toString().replace('chat-lab=', 'chat-lab')}`;
}

async function load(page, url, scheme) {
  page.errors = [];
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: scheme === 'white' ? 'light' : 'dark' },
      { name: 'prefers-reduced-motion', value: args.motion ? 'reduce' : 'no-preference' },
    ],
  });
  const nav = await page.send('Page.navigate', { url });
  if (nav.errorText) throw new Error(`navigation failed: ${nav.errorText} (${url})`);
}

async function until(page, expression) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await page.value(expression)) return true;
    await sleep(150);
  }
  return false;
}

async function sceneIds(page) {
  await load(page, sceneUrl(null, 'dark', 'beauty'), 'dark');
  if (!(await until(page, 'Array.isArray(window.__chatLabScenes)'))) {
    const state = await page.value(
      'location.href + " " + document.readyState + " " + document.body.innerText.slice(0, 120)',
    );
    throw new Error(`lab did not start (${state}) ${page.errors.join(' | ')}`);
  }
  const scenes = await page.value('window.__chatLabScenes.map((s) => s.id)');
  return filter ? scenes.filter((id) => filter.some((f) => id === f || id.startsWith(f))) : scenes;
}

async function shoot(page, scene, scheme, perf) {
  await load(page, sceneUrl(scene, scheme, perf), scheme);
  const ready = await until(page, 'window.__chatLabReady === true');
  const failure = await page.value('window.__chatLabError || ""');
  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  const file = join(out, `${scene}_${scheme}_${perf}.png`);
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  const notes = [];
  if (!ready) notes.push('NOT READY');
  if (failure) notes.push(`lab: ${failure}`);
  if (page.errors.length)
    notes.push(`${page.errors.length} page errors: ${page.errors[0].split('\n')[0]}`);
  console.log(`${file}${notes.length ? `  [${notes.join('; ')}]` : ''}`);
}

async function shootOrSkip(state, scene, scheme, perf) {
  try {
    await shoot(state.page, scene, scheme, perf);
    return true;
  } catch (error) {
    console.error(`${scene}_${scheme}_${perf}  [FAILED: ${String(error)}]`);
    await state.page.close();
    state.page = await openPage();
    return false;
  }
}

mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'chat-shots-'));
const brave = spawn(
  BRAVE,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-proxy-server',
    '--no-default-browser-check',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let code = 0;
try {
  await waitForBrowser();
  const state = { page: await openPage() };
  const scenes = await sceneIds(state.page);
  if (args.list) console.log(scenes.join('\n'));
  else {
    for (const scene of scenes) {
      for (const perf of perfs) {
        for (const scheme of schemes) {
          if (!(await shootOrSkip(state, scene, scheme, perf))) code = 1;
        }
      }
    }
  }
} catch (error) {
  console.error(String(error));
  code = 1;
} finally {
  brave.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
process.exit(code);
