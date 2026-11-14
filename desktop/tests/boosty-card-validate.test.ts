import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  brandOf,
  EMPTY_CARD,
  formatCvv,
  formatExpiry,
  formatNumber,
  invalidFields,
  luhn,
} from '../src/lib/boosty-card/validate.ts';

const NOW = new Date('2026-11-14T12:00:00Z');
const GOOD = {
  number: '4242 4242 4242 4242',
  expiry: '12/28',
  cvv: '123',
};

test('luhn accepts real test numbers and rejects a typo', () => {
  for (const ok of [
    '4242424242424242',
    '5555555555554444',
    '378282246310005',
    '2200000000000004',
  ]) {
    assert.equal(luhn(ok), true, ok);
  }
  for (const bad of ['4242424242424241', '1234567812345678']) assert.equal(luhn(bad), false, bad);
});

test('a good card has no invalid fields', () => {
  assert.deepEqual(invalidFields(GOOD, NOW), []);
});

test('every field is checked on its own', () => {
  assert.deepEqual(invalidFields({ ...GOOD, number: '4242 4242 4242 4241' }, NOW), ['number']);
  assert.deepEqual(invalidFields({ ...GOOD, expiry: '10/26' }, NOW), ['expiry']);
  assert.deepEqual(invalidFields({ ...GOOD, expiry: '13/28' }, NOW), ['expiry']);
  assert.deepEqual(invalidFields({ ...GOOD, expiry: '1/28' }, NOW), ['expiry']);
  assert.deepEqual(invalidFields({ ...GOOD, cvv: '12' }, NOW), ['cvv']);
  assert.deepEqual(invalidFields(EMPTY_CARD, NOW), ['number', 'expiry', 'cvv']);
});

test('the current month is still valid, last month is not', () => {
  assert.deepEqual(invalidFields({ ...GOOD, expiry: '11/26' }, NOW), []);
  assert.deepEqual(invalidFields({ ...GOOD, expiry: '10/26' }, NOW), ['expiry']);
  assert.deepEqual(invalidFields({ ...GOOD, expiry: '01/47' }, NOW), ['expiry']);
});

test('a fifteen digit card wants four digits of cvv, others three', () => {
  const amex = { ...GOOD, number: '3782 822463 10005' };
  assert.deepEqual(invalidFields({ ...amex, cvv: '1234' }, NOW), []);
  assert.deepEqual(invalidFields({ ...amex, cvv: '123' }, NOW), ['cvv']);
  assert.equal(formatCvv('12345', amex.number), '1234');
  assert.equal(formatCvv('12a45', GOOD.number), '124');
});

test('typing is formatted as it goes', () => {
  assert.equal(formatNumber('4242424242424242'), '4242 4242 4242 4242');
  assert.equal(formatNumber('378282246310005'), '3782 822463 10005');
  assert.equal(formatNumber('42a4 2'), '4242');
  assert.equal(formatExpiry('1'), '1');
  assert.equal(formatExpiry('3'), '03/');
  assert.equal(formatExpiry('12'), '12/');
  assert.equal(formatExpiry('1228'), '12/28');
  assert.equal(formatExpiry('12/', '12/2'), '12');
});

test('the brand follows the first digits', () => {
  assert.equal(brandOf('4242'), 'visa');
  assert.equal(brandOf('5555'), 'mc');
  assert.equal(brandOf('2221'), 'mc');
  assert.equal(brandOf('2200'), 'mir');
  assert.equal(brandOf('2204'), 'mir');
  assert.equal(brandOf('3782'), 'amex');
  assert.equal(brandOf('6200'), 'unionpay');
  assert.equal(brandOf('9'), null);
});
