import backendConfig from '../../backend.config.json';

function base(value: string): string {
  return value.replace(/\/+$/, '');
}

export const API_BASE = base(backendConfig.apiBase);
export const STREAMING_BASE = base(backendConfig.streamingBase);
export const IMAGES_BASE = base(backendConfig.imagesBase);
export const STORAGE_BASE = base(backendConfig.storageBase);
/** Passive listening telemetry is opt-in for self-hosted deployments. */
export const SEND_BEHAVIORAL_DATA = backendConfig.sendBehavioralData === true;
export const BACKEND_HOSTS = [API_BASE, STREAMING_BASE, IMAGES_BASE, STORAGE_BASE]
  .map((value) => new URL(value).hostname.toLowerCase())
  .filter((value, index, values) => values.indexOf(value) === index);

let staticPort: number | null = null;
let proxyPort: number | null = null;

export function setServerPorts(staticP: number, proxy: number) {
  staticPort = staticP;
  proxyPort = proxy;
}

export function getStaticPort(): number | null {
  return staticPort;
}

export function getProxyPort(): number | null {
  return proxyPort;
}
