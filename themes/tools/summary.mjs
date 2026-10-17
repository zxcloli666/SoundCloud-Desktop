import { appendFileSync } from 'node:fs';

const LIST_LIMIT = 10;

export function md(text) {
  return String(text).replace(/[\\`*_{}[\]()<>#+!|~&:.@\r\n]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function cell(value) {
  if (!Array.isArray(value)) return md(value === '' ? '-' : value);
  if (value.length === 0) return '-';
  const shown = value.slice(0, LIST_LIMIT).map(md);
  if (value.length > LIST_LIMIT) shown.push(md(`and ${value.length - LIST_LIMIT} more`));
  return shown.join('<br>');
}

export function table(head, rows) {
  const line = (cells) => `| ${cells.map(cell).join(' | ')} |`;
  return [line(head), `|${head.map(() => ' --- |').join('')}`, ...rows.map(line)].join('\n');
}

export function print(line) {
  console.log(String(line).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' '));
}

export function writeSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${markdown}\n\n`);
}

export function kib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
