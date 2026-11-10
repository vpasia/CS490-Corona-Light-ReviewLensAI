import { requireOwner } from './ownership.js';
import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';
import { productAsin, isFresh, cacheQuery } from './reviewCache.js';

export function validateReviewIdentity(uid, productId) {
    if (typeof uid !== 'string' || !uid.trim())
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    if (
        typeof productId !== 'string' ||
        !productId.trim() ||
        productId.includes('/')
    )
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Invalid product identifier.'
        );
}

// Shared datasets must be published with their metadata and run atomically.
// Retain the old export so old callers fail explicitly instead of making partial writes.
export async function saveReviews(uid, productId) {
    validateReviewIdentity(uid, productId);
    throw new AppError(
        409,
        'USE_INGESTION_SERVICE',
        'Save reviews through the ingestion coordinator.'
    );
}

export async function getReviews(uid, productId, db) {
    validateReviewIdentity(uid, productId);
    const database = db ?? getDb();
    return database.runTransaction(async (tx) => {
        const product = requireOwner(
            await tx.get(database.collection('products').doc(productId)),
            uid
        );
        const asin = productAsin(product);
        const cache = (
            await tx.get(database.collection('reviewCaches').doc(asin))
        ).data();
        if (!isFresh(cache)) return [];
        const snapshot = await tx.get(
            cacheQuery(database, asin, cache.version)
        );
        if (snapshot.docs.length !== cache.reviewCount)
            throw new AppError(
                503,
                'REVIEW_CACHE_INCOMPLETE',
                'Review data needs to be refreshed.'
            );
        return snapshot.docs.map((doc) => ({
            ...doc.data(),
            reviewId: doc.id,
        }));
    });
}
