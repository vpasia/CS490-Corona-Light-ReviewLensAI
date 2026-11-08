import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';
import { getOwnedProduct } from './ownership.js';
import { normalizeReviews } from './reviewNormalizer.js';

// A bounded batch keeps each save atomic. Larger imports must be designed
// with explicit partial-write/result handling rather than silently chunked.
const MAX_REVIEWS_PER_SAVE = 400;

function validateProductId(productId) {
    if (
        typeof productId !== 'string' ||
        !productId.trim() ||
        productId.includes('/')
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Invalid product identifier.'
        );
    }
}

export async function saveReviews(uid, productId, records, db) {
    // Validate identity before resolving a real database connection.
    if (typeof uid !== 'string' || !uid.trim()) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }
    validateProductId(productId);
    if (!Array.isArray(records) || records.length > MAX_REVIEWS_PER_SAVE) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `Provide an array of at most ${MAX_REVIEWS_PER_SAVE} reviews.`
        );
    }
    // Defense in depth: allowlist again, stripping forged IDs/ownership.
    // Reject the entire save if any review is invalid; do not hide data loss.
    const { reviews, rejected } = normalizeReviews(records);
    if (rejected.length) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Reviews must contain valid text and ratings.',
            rejected.map(({ index, reason }) => ({
                field: `reviews[${index}]`,
                message: reason,
            }))
        );
    }
    const database = db ?? getDb();
    await getOwnedProduct(uid, productId, database);
    if (!reviews.length) return { reviewIds: [], count: 0 };

    const batch = database.batch();
    const reviewIds = [];
    for (const review of reviews) {
        const ref = database.collection('reviews').doc();
        batch.set(ref, {
            ...review,
            reviewId: ref.id,
            userId: uid,
            productId,
            createdAt: FieldValue.serverTimestamp(),
        });
        reviewIds.push(ref.id);
    }
    await batch.commit();
    return { reviewIds, count: reviewIds.length };
}

export async function getReviews(uid, productId, db) {
    if (typeof uid !== 'string' || !uid.trim()) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }
    validateProductId(productId);
    const database = db ?? getDb();
    await getOwnedProduct(uid, productId, database);
    const snapshot = await database
        .collection('reviews')
        .where('userId', '==', uid)
        .where('productId', '==', productId)
        .get();
    return snapshot.docs.map((doc) => ({ ...doc.data(), reviewId: doc.id }));
}
