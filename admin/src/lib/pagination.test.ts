import { describe, expect, it } from 'vitest';
import { directoryQuery } from './pagination';

// The directory query builder: page/limit are always sent; search/filter only
// when non-empty (and trimmed), so blank inputs don't become "search=".
describe('directoryQuery', () => {
  it('always includes page and limit as strings', () => {
    expect(directoryQuery({ page: 2, limit: 10 })).toEqual({
      page: '2',
      limit: '10',
    });
  });

  it('includes trimmed search and filter when present', () => {
    expect(
      directoryQuery({ page: 1, limit: 20, search: '  kigali ', filter: 'driver' }),
    ).toEqual({ page: '1', limit: '20', search: 'kigali', filter: 'driver' });
  });

  it('omits blank / whitespace-only search and filter', () => {
    expect(
      directoryQuery({ page: 1, limit: 20, search: '   ', filter: '' }),
    ).toEqual({ page: '1', limit: '20' });
  });
});
