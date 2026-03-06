let cacheServerPort: number | null = null;

export function setCacheServerPort(port: number) {
  cacheServerPort = port;
}

export function getCacheServerPort(): number | null {
  return cacheServerPort;
}
