import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../utils/AppError.js';
import { normalizeReviews } from './reviewNormalizer.js';

export function prepareReviewRecords(records) {
    if (!Array.isArray(records) || records.length > 400) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Provide an array of at most 400 reviews.'
        );
    }
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
    return reviews;
}

// Internal write helper. Caller MUST verify ownership before staging writes.
// writer can be a batch or transaction; it is committed only by the caller.
export function stageReviewWrites(writer, database, uid, productId, reviews) {
    return reviews.map((review) => {
        const ref = database.collection('reviews').doc();
        writer.set(ref, {
            ...review,
            reviewId: ref.id,
            userId: uid,
            productId,
            createdAt: FieldValue.serverTimestamp(),
        });
        return ref.id;
    });
}
