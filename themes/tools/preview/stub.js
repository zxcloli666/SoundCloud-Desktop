(() => {
  const preview = window.__SC_PREVIEW__;
  const encoder = new TextEncoder();
  const callbacks = new Map();
  const unknown = new Set();
  const requests = [];
  let nextId = 1;

  const frame = (status, body) => {
    const head = encoder.encode(
      JSON.stringify({ status, statusText: '', headers: [['content-type', 'application/json']] }),
    );
    const data = body === undefined ? new Uint8Array(0) : encoder.encode(JSON.stringify(body));
    const bytes = new Uint8Array(4 + head.length + data.length);
    new DataView(bytes.buffer).setUint32(0, head.length);
    bytes.set(head, 4);
    bytes.set(data, 4 + head.length);
    return bytes.buffer;
  };

  const answers = {
    auth_status: { token: 'preview', premium: false },
    get_server_ports: () => [preview.port, preview.port],
    custom_css_suppressed: false,
    'plugin:path|resolve_directory': '/preview',
    'plugin:path|join': (args) => args.paths.join('/'),
    'plugin:fs|exists': (args) => args.path in preview.files,
    'plugin:fs|read_text_file': (args) => encoder.encode(preview.files[args.path] ?? '').buffer,
    'plugin:fs|read_dir': [],
    'plugin:event|listen': () => nextId++,
    net_fetch: (args) => {
      const url = new URL(args.request.url);
      requests.push(`${args.request.method} ${url.host}${url.pathname}${url.search}`);
      if (url.pathname === '/health') return frame(200);
      const body = preview.api[url.pathname];
      return body === undefined ? frame(404, { error: 'preview' }) : frame(200, body);
    },
    'plugin:window|is_maximized': false,
    'plugin:window|is_fullscreen': false,
    'plugin:window|is_focused': true,
    'plugin:window|is_visible': true,
    'plugin:window|scale_factor': 1,
    'plugin:window|inner_size': { width: 1280, height: 800 },
    'plugin:window|outer_size': { width: 1280, height: 800 },
    'plugin:app|version': preview.appVersion,
    'plugin:app|name': 'soundcloud-desktop',
  };

  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { windowLabel: 'main', label: 'main' },
    },
    plugins: {},
    transformCallback(callback, once) {
      const id = nextId++;
      callbacks.set(id, { callback, once });
      return id;
    },
    unregisterCallback(id) {
      callbacks.delete(id);
    },
    convertFileSrc(path) {
      return path;
    },
    async invoke(cmd, args = {}) {
      if (!(cmd in answers)) {
        unknown.add(cmd);
        return null;
      }
      const answer = answers[cmd];
      return typeof answer === 'function' ? answer(args) : answer;
    },
  };
  Object.defineProperty(Navigator.prototype, 'onLine', { get: () => true });
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
  window.__SC_PREVIEW_UNKNOWN__ = unknown;
  window.__SC_PREVIEW_REQUESTS__ = requests;

  const style = document.createElement('style');
  style.id = 'sc-theme-css';
  style.textContent = preview.css;
  window.__SC_PREVIEW_STYLE__ = style;
  const quiet = document.createElement('style');
  quiet.textContent = '[data-sonner-toaster] { display: none !important; }';
  document.addEventListener('DOMContentLoaded', () => document.head.append(quiet, style));
})();
