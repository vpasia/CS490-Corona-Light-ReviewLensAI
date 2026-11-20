import { describe, expect, it } from 'vitest';

import { getRunCounts } from './runCounts.js';

describe('getRunCounts', () => {
  it('returns nothing when there is no run or the import is still running', () => {
    expect(getRunCounts(null)).toBeNull();
    expect(getRunCounts(undefined)).toBeNull();
    expect(getRunCounts({ status: 'processing' })).toBeNull();
  });

  it('reports saved, skipped and duplicate counts for a successful import', () => {
    expect(
      getRunCounts({
        status: 'succeeded',
        reused: false,
        receivedCount: 15,
        acceptedCount: 13,
        rejectedCount: 2,
        savedCount: 12,
      }),
    ).toEqual({ kind: 'succeeded', saved: 12, rejected: 2, duplicates: 1 });
  });

  it('reports no skipped records and no duplicates for a clean import', () => {
    expect(
      getRunCounts({
        status: 'succeeded',
        reused: false,
        receivedCount: 13,
        acceptedCount: 13,
        rejectedCount: 0,
        savedCount: 13,
      }),
    ).toEqual({ kind: 'succeeded', saved: 13, rejected: 0, duplicates: 0 });
  });

  it('reports reused reviews instead of zero skipped records', () => {
    expect(
      getRunCounts({
        status: 'succeeded',
        reused: true,
        receivedCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        savedCount: 0,
        reviewCount: 30,
      }),
    ).toEqual({ kind: 'reused', reviewCount: 30 });
  });

  it('reports the skipped records of a failed import', () => {
    expect(getRunCounts({ status: 'failed', rejectedCount: 13, savedCount: 0 })).toEqual({
      kind: 'failed',
      rejected: 13,
    });
    expect(getRunCounts({ status: 'failed' })).toEqual({ kind: 'failed', rejected: 0 });
  });

  it('shows nothing rather than guessing when the saved count is missing or invalid', () => {
    expect(getRunCounts({ status: 'succeeded', reused: false })).toBeNull();
    expect(getRunCounts({ status: 'succeeded', reused: false, savedCount: -1 })).toBeNull();
    expect(getRunCounts({ status: 'succeeded', reused: true })).toBeNull();
  });

  it('never reports a negative duplicate count', () => {
    expect(
      getRunCounts({ status: 'succeeded', reused: false, acceptedCount: 3, savedCount: 5 }),
    ).toMatchObject({ duplicates: 0 });
  });
});
