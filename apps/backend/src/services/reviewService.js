import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';
import { getOwnedProduct } from './ownership.js';
import { prepareReviewRecords, stageReviewWrites } from './reviewWrites.js';

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
    const reviews = prepareReviewRecords(records);
    const database = db ?? getDb();
    await getOwnedProduct(uid, productId, database);
    if (!reviews.length) return { reviewIds: [], count: 0 };

    const batch = database.batch();
    const reviewIds = stageReviewWrites(
        batch,
        database,
        uid,
        productId,
        reviews
    );
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
