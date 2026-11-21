// The backend returns ingestion runs unordered, with Firestore timestamps that may arrive as
// { _seconds, _nanoseconds } or { seconds, nanoseconds }. This reads those shapes (and ISO
// strings or milliseconds) so the newest run can be found without trusting list order.
function toMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object') {
    const seconds = value._seconds ?? value.seconds;
    const nanoseconds = value._nanoseconds ?? value.nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      return seconds * 1000 + Math.floor(nanoseconds / 1e6);
    }
  }
  return 0;
}

export function pickLatestRun(runs) {
  if (!Array.isArray(runs)) {
    return null;
  }
  const validRuns = runs.filter((run) => run && typeof run === 'object' && !Array.isArray(run));
  if (validRuns.length === 0) {
    return null;
  }
  return validRuns.reduce((latest, run) =>
    toMillis(run.startedAt) > toMillis(latest.startedAt) ? run : latest,
  );
}
