import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, formatRate } from './format';

// Display formatters. The key rule: a null value is honestly "No data yet",
// never a fabricated 0% / 0 — so an empty pilot doesn't look like real signal.
describe('metrics formatters', () => {
  describe('formatRate', () => {
    it('renders a fraction as a whole percent', () => {
      expect(formatRate(0.42)).toBe('42%');
      expect(formatRate(1)).toBe('100%');
    });
    it('shows "No data yet" for null (never 0%)', () => {
      expect(formatRate(null)).toBe('No data yet');
    });
  });

  describe('formatDuration', () => {
    it('shows seconds under a minute', () => {
      expect(formatDuration(45)).toBe('45s');
    });
    it('shows minutes and remainder seconds', () => {
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(120)).toBe('2m');
    });
    it('shows "No data yet" for null', () => {
      expect(formatDuration(null)).toBe('No data yet');
    });
  });

  describe('formatNumber', () => {
    it('stringifies a value, "No data yet" for null', () => {
      expect(formatNumber(7)).toBe('7');
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(null)).toBe('No data yet');
    });
  });
});
