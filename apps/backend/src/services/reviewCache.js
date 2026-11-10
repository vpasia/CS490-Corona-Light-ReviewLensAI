import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../utils/AppError.js';
import { parseAmazonSource } from '../utils/amazonSource.js';

export const REVIEW_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const LEASE_MS = 5 * 60 * 1000;
export const clearLock = () => ({
    activeIngestionRunId: FieldValue.delete(),
    ingestionLockUntil: FieldValue.delete(),
});
export function productAsin(product) {
    const { asin } = parseAmazonSource(product.amazonUrl);
    if (product.asin && product.asin !== asin)
        throw new AppError(
            409,
            'PRODUCT_ASIN_MISMATCH',
            'Product source information needs updating.'
        );
    return asin;
}
export function isFresh(cache, now = Date.now()) {
    return (
        !cache?.deleting &&
        typeof cache?.version === 'string' &&
        Number.isInteger(cache.reviewCount) &&
        cache.reviewCount > 0 &&
        Number.isFinite(cache.fetchedAtMs) &&
        Number.isFinite(cache.expiresAtMs) &&
        cache.fetchedAtMs <= now &&
        cache.expiresAtMs === cache.fetchedAtMs + REVIEW_TTL_MS &&
        cache.expiresAtMs > now
    );
}
export function deduplicateReviews(reviews) {
    const seen = new Set();
    return reviews.filter((review) => {
        const key = review.sourceReviewId
            ? `id:${review.sourceReviewId}`
            : `body:${createHash('sha256')
                  .update(
                      JSON.stringify([
                          review.text,
                          review.rating,
                          review.title ?? '',
                          review.reviewerName ?? '',
                      ])
                  )
                  .digest('hex')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
export function cacheQuery(db, asin, version) {
    return db
        .collection('reviews')
        .where('asin', '==', asin)
        .where('cacheVersion', '==', version);
}
export async function deleteQuery(db, query) {
    // Repeat bounded batches so interrupted cleanup can be retried.
    for (;;) {
        const page = await query.limit(400).get();
        if (!page.docs.length) return;
        const batch = db.batch();
        for (const doc of page.docs) batch.delete(doc.ref);
        await batch.commit();
    }
}
