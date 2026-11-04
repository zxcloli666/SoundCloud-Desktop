import { labAvatar } from './pictures';
import { world } from './world';

const USER = {
  id: 7001,
  urn: 'soundcloud:users:7001',
  username: 'Лёша',
  avatar_url: '',
  permalink_url: 'https://soundcloud.com/lab',
  followers_count: 214,
  followings_count: 96,
  track_count: 12,
  playlist_count: 4,
};

function frame(status: number, body: unknown): Uint8Array {
  const head = new TextEncoder().encode(
    JSON.stringify({
      status,
      statusText: '',
      headers: [['content-type', 'application/json']],
      url: '',
    }),
  );
  const payload = new TextEncoder().encode(JSON.stringify(body));
  const out = new Uint8Array(4 + head.length + payload.length);
  new DataView(out.buffer).setUint32(0, head.length);
  out.set(head, 4);
  out.set(payload, 4 + head.length);
  return out;
}

function netFetch(args: Record<string, unknown>): Uint8Array {
  const request = args.request as { url: string };
  if (request.url.includes('/me/cold')) {
    return frame(200, { ...USER, avatar_url: labAvatar('Лёша') });
  }
  if (request.url.includes('/me/subscription')) {
    return frame(200, { premium: world.config.media?.star === true, entitlements: [] });
  }
  return frame(404, {});
}

export function plainCommand(cmd: string, args: Record<string, unknown> | undefined): unknown {
  switch (cmd) {
    case 'lab_probe':
      return 'lab';
    case 'get_server_ports':
      return [0, 0];
    case 'auth_status':
      return { token: 'lab-session', premium: true };
    case 'edge_config':
      return {};
    case 'net_fetch':
      return netFetch(args ?? {});
    case 'plugin:fs|exists':
      return false;
    default:
      return null;
  }
}
