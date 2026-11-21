import { describe, expect, it } from 'vitest';

import { pickLatestRun } from './ingestionRuns.js';

describe('pickLatestRun', () => {
  it('returns null when there are no runs or the input is not a list', () => {
    expect(pickLatestRun([])).toBeNull();
    expect(pickLatestRun(undefined)).toBeNull();
    expect(pickLatestRun({})).toBeNull();
  });

  it('picks the run that started most recently, whatever the list order', () => {
    const older = {
      ingestionRunId: 'a',
      status: 'failed',
      startedAt: { _seconds: 100, _nanoseconds: 0 },
    };
    const newer = {
      ingestionRunId: 'b',
      status: 'succeeded',
      startedAt: { _seconds: 200, _nanoseconds: 0 },
    };

    expect(pickLatestRun([older, newer])).toBe(newer);
    expect(pickLatestRun([newer, older])).toBe(newer);
  });

  it('understands the seconds shape and ISO date strings', () => {
    const older = { ingestionRunId: 'a', startedAt: { seconds: 1000, nanoseconds: 0 } };
    const newer = { ingestionRunId: 'b', startedAt: '2026-11-10T10:00:00.000Z' };

    expect(pickLatestRun([newer, older])).toBe(newer);
  });

  it('ignores entries that are not run objects', () => {
    const run = { ingestionRunId: 'a', status: 'succeeded', startedAt: { _seconds: 5 } };

    expect(pickLatestRun([null, 'oops', 7, run])).toBe(run);
  });
});
