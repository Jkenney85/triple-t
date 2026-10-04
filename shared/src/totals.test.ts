import { describe, expect, it } from 'vitest';
import { computeTotal, defaultTotalMode, formatNumber, parseNumeric } from './totals';

describe('totals math', () => {
  it('sums numbers across videos', () => {
    expect(computeTotal({ type: 'number', totalMode: 'sum' }, ['100', '250', '1,000'])).toBe(1350);
  });

  it('sums currency, ignoring $ signs and commas', () => {
    expect(computeTotal({ type: 'currency', totalMode: 'sum' }, ['$1,200.50', '99.5'])).toBeCloseTo(1300);
  });

  it('averages percentages', () => {
    expect(computeTotal({ type: 'percent', totalMode: 'avg' }, ['4', '2.5%', '3.5'])).toBeCloseTo(10 / 3);
  });

  it('skips blank and invalid values instead of counting them as zero', () => {
    expect(computeTotal({ type: 'percent', totalMode: 'avg' }, ['4', '', undefined, null, 'n/a', '2'])).toBe(3);
    expect(computeTotal({ type: 'number', totalMode: 'sum' }, ['5', '', 'abc'])).toBe(5);
  });

  it('returns null when there is nothing to total', () => {
    expect(computeTotal({ type: 'number', totalMode: 'sum' }, [])).toBeNull();
    expect(computeTotal({ type: 'number', totalMode: 'sum' }, ['', undefined])).toBeNull();
  });

  it('returns null for total mode "none" and non-numeric fields', () => {
    expect(computeTotal({ type: 'number', totalMode: 'none' }, ['1', '2'])).toBeNull();
    expect(computeTotal({ type: 'text', totalMode: 'sum' }, ['1', '2'])).toBeNull();
  });

  it('defaults: sum for number and currency, average for percent, none otherwise', () => {
    expect(defaultTotalMode('number')).toBe('sum');
    expect(defaultTotalMode('currency')).toBe('sum');
    expect(defaultTotalMode('percent')).toBe('avg');
    expect(defaultTotalMode('text')).toBe('none');
    expect(defaultTotalMode('date')).toBe('none');
  });

  it('parses user-entered numbers', () => {
    expect(parseNumeric(' 12,345 ')).toBe(12345);
    expect(parseNumeric('-3.5%')).toBe(-3.5);
    expect(parseNumeric('')).toBeNull();
    expect(parseNumeric('1.2.3')).toBeNull();
  });

  it('formats totals', () => {
    expect(formatNumber('currency', 6070.5)).toBe('$6,070.50');
    expect(formatNumber('percent', 3.333333)).toBe('3.33%');
    expect(formatNumber('number', 173000, { compact: true })).toBe('173K');
  });
});
