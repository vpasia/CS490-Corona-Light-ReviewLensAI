import { getRunCounts } from './runCounts.js';

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

function skippedText(rejected) {
  const phrase = pluralize(
    rejected,
    'record couldn’t be used and was skipped',
    'records couldn’t be used and were skipped',
  );
  return `${rejected} ${phrase}. They are not part of the review dataset.`;
}

function buildItems(counts) {
  const items = [];

  if (counts.kind === 'reused') {
    items.push({
      key: 'reused',
      tone: 'text-[#1F1F1F]',
      text: `Using ${counts.reviewCount} saved ${pluralize(counts.reviewCount, 'review', 'reviews')}. No new records were checked.`,
    });
    return items;
  }

  if (counts.kind === 'succeeded') {
    items.push({
      key: 'saved',
      tone: 'text-[#1F1F1F]',
      text: `${counts.saved} ${pluralize(counts.saved, 'review', 'reviews')} saved.`,
    });
  } else {
    items.push({
      key: 'none-saved',
      tone: 'text-[#1F1F1F]',
      text: 'No reviews were saved from this import.',
    });
  }

  if (counts.rejected > 0) {
    items.push({ key: 'skipped', tone: 'text-[#D97706]', text: skippedText(counts.rejected) });
  }
  if (counts.kind === 'succeeded' && counts.duplicates > 0) {
    items.push({
      key: 'duplicates',
      tone: 'text-[#6B6B6B]',
      text: `${counts.duplicates} duplicate ${pluralize(counts.duplicates, 'review was', 'reviews were')} left out.`,
    });
  }

  return items;
}

export default function ImportResultCounts({ run }) {
  const counts = getRunCounts(run);
  if (!counts) {
    return null;
  }

  return (
    <ul
      aria-label="Import results"
      className="flex flex-col gap-1 border-t border-[#E5E5E5] pt-4 text-sm"
    >
      {buildItems(counts).map((item) => (
        <li key={item.key} className={item.tone}>
          {item.text}
        </li>
      ))}
    </ul>
  );
}
