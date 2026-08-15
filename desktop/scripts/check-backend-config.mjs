import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const config = readJson('backend.config.json');
const capability = readJson('src-tauri/capabilities/default.json');
const httpPermission = capability.permissions.find(
  (permission) => typeof permission === 'object' && permission.identifier === 'http:default',
);

if (!httpPermission) throw new Error('default capability has no http:default permission');
const allowed = new Set(httpPermission.allow?.map((entry) => entry.url) ?? []);

function parseBase(field) {
  const raw = config[field];
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error(`backend.config.json ${field} must be a non-empty URL`);
  }
  const url = new URL(raw);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error(`${field} must use HTTPS; HTTP is allowed only for local development`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${field} must not contain credentials, a query or a fragment`);
  }
  return url;
}

function originAllowed(url) {
  if (allowed.has(url.origin)) return true;
  return allowed.has(`${url.protocol}//${url.hostname}:*`);
}

for (const field of ['apiBase', 'streamingBase', 'imagesBase', 'storageBase']) {
  const url = parseBase(field);
  if (!originAllowed(url)) {
    throw new Error(
      `${field} origin ${url.origin} is missing from src-tauri/capabilities/default.json`,
    );
  }
}

if (config.healthBase !== null && config.healthBase !== undefined) parseBase('healthBase');
if (config.relayZone !== null && config.relayZone !== undefined) {
  const zone = String(config.relayZone).trim().replace(/\.+$/, '');
  if (!zone || !allowed.has(`https://*.${zone}`)) {
    throw new Error(`relayZone ${zone || '(empty)'} is missing from the HTTP capability`);
  }
}

if (typeof config.sendBehavioralData !== 'boolean') {
  throw new Error('backend.config.json sendBehavioralData must be a boolean');
}

console.log('Backend configuration and Tauri HTTP scope agree.');
