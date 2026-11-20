import type { ArgSpec, Args, ArgsSchema, ArgValue } from './types';

export const ARG_TEXT_MAX = 200;

export type ArgsRead = { ok: true; args: Args } | { ok: false; reason: string };

function text(raw: unknown, spec: ArgSpec): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.replace(/\s+/g, ' ').trim().slice(0, ARG_TEXT_MAX);
  if (!value) return null;
  if (!spec.enum) return value;
  return spec.enum.find((option) => option.toLowerCase() === value.toLowerCase()) ?? null;
}

function number(raw: unknown, whole: boolean): number | null {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return whole ? Math.round(value) : value;
}

function flag(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function read(raw: unknown, spec: ArgSpec): ArgValue | null {
  if (spec.type === 'string') return text(raw, spec);
  if (spec.type === 'boolean') return flag(raw);
  return number(raw, spec.type === 'integer');
}

export function readArgs(schema: ArgsSchema, raw: unknown): ArgsRead {
  const given = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const args: Args = {};
  for (const [name, spec] of Object.entries(schema.properties)) {
    const missing = given[name] === undefined || given[name] === null;
    if (missing && !schema.required.includes(name)) continue;
    const value = missing ? null : read(given[name], spec);
    if (value === null) return { ok: false, reason: `bad_args:${name}` };
    args[name] = value;
  }
  return { ok: true, args };
}
