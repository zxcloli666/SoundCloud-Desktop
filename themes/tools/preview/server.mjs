import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const STUB = readFileSync(join(import.meta.dirname, 'stub.js'), 'utf8');

export function startServer(dist, payloads) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (/^\/(img|p)\//.test(url.pathname)) {
      let seed = 0;
      for (const char of url.pathname) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
      const hue = seed % 360;
      const x = 20 + (seed % 60);
      const y = 20 + ((seed >> 8) % 60);
      res.writeHead(200, { 'content-type': TYPES['.svg'], 'access-control-allow-origin': '*' });
      res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 70% 58%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360} 65% 22%)"/>
</linearGradient></defs>
<rect width="100" height="100" fill="url(#g)"/>
<circle cx="${x}" cy="${y}" r="${18 + (seed % 14)}" fill="hsl(${(hue + 180) % 360} 80% 70%)" opacity="0.35"/>
</svg>`);
      return;
    }

    let path = '';
    let body = null;
    try {
      path = normalize(join(dist, decodeURIComponent(url.pathname)));
      if (path.startsWith(dist) && extname(path)) body = readFileSync(path);
    } catch {}
    if (body) {
      const type = TYPES[extname(path)] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      res.end(
        type === TYPES['.css']
          ? body
              .toString('utf8')
              .replace(/-webkit-backdrop-filter:([^;}]*)/g, '$&;backdrop-filter:$1')
          : body,
      );
      return;
    }

    const payload = payloads.get(url.searchParams.get('theme'));
    if (!payload) {
      res.writeHead(404);
      res.end();
      return;
    }
    const data = JSON.stringify(payload).replace(/</g, '\\u003c');
    const head = `<script>window.__SC_PREVIEW__=${data};</script><script>${STUB}</script>`;
    const html = readFileSync(join(dist, 'index.html'), 'utf8').replace('<head>', `<head>${head}`);
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    res.end(html);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
