import { describe, expect, it } from 'vitest';
import policyJson from './policy.json';
import type { Policy } from './types';

const policy = policyJson as Policy;

describe('shared privacy policy content', () => {
  it('loads with meta present', () => {
    expect(policy.version).not.toBe('');
    expect(policy.lastUpdated).not.toBe('');
    expect(policy.contactEmail).toContain('@');
  });

  it('has all eleven sections, numbered 1..11 in order', () => {
    const numbers = policy.sections.map((s) => s.number);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('every section has a heading and at least one block', () => {
    for (const s of policy.sections) {
      expect(s.heading.length).toBeGreaterThan(0);
      expect(s.blocks.length).toBeGreaterThan(0);
    }
  });

  it('collects any remaining placeholders into one object', () => {
    // All placeholders are currently filled, so the set is empty; the shape must
    // still be present so the renderer can flag any future unfilled value.
    expect(policy.placeholders).toBeTypeOf('object');
  });
});
