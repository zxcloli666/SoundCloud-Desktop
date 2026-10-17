import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FLAGS = [
  '--headless=new',
  '--no-sandbox',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--remote-debugging-port=0',
];

export async function launchChrome(binary) {
  const profile = mkdtempSync(join(tmpdir(), 'theme-preview-'));
  const child = spawn(binary, [...FLAGS, `--user-data-dir=${profile}`, 'about:blank'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    child.stderr.on('data', (chunk) => {
      log += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (match) resolve(match[1]);
    });
    child.on('exit', (code) => reject(new Error(`chrome exited with ${code}\n${log}`)));
  });
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
      else waiter.resolve(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  };

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, method });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const close = async () => {
    socket.close();
    const exited = new Promise((done) => child.once('exit', done));
    child.kill('SIGKILL');
    await exited;
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    } catch {}
  };

  return { send, listeners, close };
}
