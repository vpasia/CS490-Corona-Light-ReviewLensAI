import { parseAmazonSource } from '../utils/amazonSource.js';
import { normalizeReview } from './reviewNormalizer.js';

// Pure planning only. No review text, credentials or owner IDs are printed by the CLI.
export function planReviewMigration(products, reviews) {
    const owners = new Map();
    const asins = new Map(),
        updates = [],
        skipped = [];
    for (const product of products) {
        try {
            const { asin } = parseAmazonSource(product.amazonUrl);
            if (product.asin && product.asin !== asin) {
                skipped.push({
                    collection: 'products',
                    id: product.id,
                    reason: 'ASIN_MISMATCH',
                });
                continue;
            }
            asins.set(product.id, asin);
            owners.set(product.id, product.userId);
            if (!product.asin)
                updates.push({
                    collection: 'products',
                    id: product.id,
                    fields: { asin },
                });
        } catch {
            skipped.push({
                collection: 'products',
                id: product.id,
                reason: 'UNSUPPORTED_URL',
            });
        }
    }
    for (const review of reviews) {
        if (review.asin && review.cacheVersion) continue;
        if (
            /^test-review-/i.test(review.sourceReviewId ?? '') ||
            /^sample review for database testing:/i.test(review.text ?? '')
        ) {
            skipped.push({
                collection: 'reviews',
                id: review.id,
                reason: 'SYNTHETIC_SAMPLE',
            });
            continue;
        }
        const asin = asins.get(review.productId);
        if (
            !asin ||
            review.userId !== owners.get(review.productId) ||
            (review.asin && review.asin !== asin) ||
            !normalizeReview(review).review
        ) {
            skipped.push({
                collection: 'reviews',
                id: review.id,
                reason: 'UNRESOLVED_OR_INVALID',
            });
            continue;
        }
        // Old records do not prove the original scrape time. Preserve them as inactive,
        // expired legacy data rather than incorrectly making them fresh on migration.
        updates.push({
            collection: 'reviews',
            id: review.id,
            fields: {
                asin,
                cacheVersion: 'legacy-unpublished',
                fetchedAtMs: 0,
                expiresAtMs: 0,
            },
        });
    }
    return { updates, skipped };
}
