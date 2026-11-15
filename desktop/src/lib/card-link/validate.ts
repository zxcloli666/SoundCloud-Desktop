export interface CardFields {
  number: string;
  expiry: string;
  cvv: string;
}

export type FieldName = keyof CardFields;
export type Brand = 'mir' | 'visa' | 'mc' | 'amex' | 'unionpay';

const NUMBER_LENGTHS = [12, 19] as const;
const MAX_YEARS_AHEAD = 20;

export const EMPTY_CARD: CardFields = { number: '', expiry: '', cvv: '' };

export function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function brandOf(number: string): Brand | null {
  const d = digitsOf(number);
  if (/^2(20[0-4])/.test(d)) return 'mir';
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(d)) return 'mc';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^62/.test(d)) return 'unionpay';
  if (d.startsWith('4')) return 'visa';
  return null;
}

export function cvvLength(number: string): number {
  return brandOf(number) === 'amex' ? 4 : 3;
}

export function formatNumber(raw: string): string {
  const d = digitsOf(raw).slice(0, 19);
  if (brandOf(d) === 'amex') {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ');
  }
  return d.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpiry(raw: string, previous = ''): string {
  const d = digitsOf(raw).slice(0, 4);
  if (d.length === 0) return '';
  const month = d.length === 1 && d > '1' ? `0${d}` : d.slice(0, 2);
  const rest = d.length === 1 && d > '1' ? '' : d.slice(2);
  if (rest) return `${month}/${rest}`;
  const deleting = raw.length < previous.length;
  return month.length === 2 && !deleting ? `${month}/` : month;
}

export function formatCvv(raw: string, number: string): string {
  return digitsOf(raw).slice(0, cvvLength(number));
}

export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function validNumber(raw: string): boolean {
  const d = digitsOf(raw);
  return d.length >= NUMBER_LENGTHS[0] && d.length <= NUMBER_LENGTHS[1] && luhn(d);
}

function validExpiry(raw: string, now: Date): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(raw);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const thisYear = now.getFullYear();
  if (year > thisYear + MAX_YEARS_AHEAD) return false;
  return year * 12 + month >= thisYear * 12 + now.getMonth() + 1;
}

export function invalidFields(card: CardFields, now = new Date()): FieldName[] {
  const checks: Record<FieldName, boolean> = {
    number: validNumber(card.number),
    expiry: validExpiry(card.expiry, now),
    cvv: card.cvv.length === cvvLength(card.number),
  };
  return (Object.keys(checks) as FieldName[]).filter((name) => !checks[name]);
}
