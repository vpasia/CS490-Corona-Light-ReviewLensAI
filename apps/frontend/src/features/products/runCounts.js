function toCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

// Turns a saved ingestion run into the numbers shown to the user. Everything comes from the
// persisted run, nothing is estimated. Returns null when there is nothing trustworthy to show.
export function getRunCounts(run) {
  if (!run || typeof run !== 'object') {
    return null;
  }

  if (run.status === 'succeeded') {
    if (run.reused === true) {
      const reviewCount = toCount(run.reviewCount);
      return reviewCount === null ? null : { kind: 'reused', reviewCount };
    }

    const saved = toCount(run.savedCount);
    if (saved === null) {
      return null;
    }
    const accepted = toCount(run.acceptedCount);
    return {
      kind: 'succeeded',
      saved,
      rejected: toCount(run.rejectedCount) ?? 0,
      duplicates: accepted === null ? 0 : Math.max(accepted - saved, 0),
    };
  }

  if (run.status === 'failed') {
    return { kind: 'failed', rejected: toCount(run.rejectedCount) ?? 0 };
  }

  return null;
}
