import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';
import { getOwnedProduct } from './ownership.js';
import { fetchCanopyReviews, parseAmazonSource } from './canopyService.js';
import { normalizeReviews } from './reviewNormalizer.js';
import { prepareReviewRecords, stageReviewWrites } from './reviewWrites.js';

const LEASE_MS = 5 * 60 * 1000;

function validateIdentity(uid, productId) {
    if (typeof uid !== 'string' || !uid.trim()) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }
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
function requireOwner(snapshot, uid) {
    if (!snapshot.exists || snapshot.data()?.userId !== uid) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }
    return snapshot.data();
}
function safeFailure(error) {
    if (error?.code === 'NO_VALID_REVIEWS') {
        return {
            code: 'NO_VALID_REVIEWS',
            message: 'No usable reviews were returned for this product.',
        };
    }
    if (error?.code === 'VALIDATION_ERROR') {
        return {
            code: 'VALIDATION_ERROR',
            message: 'The review import exceeded supported input limits.',
        };
    }
    if (error?.code === 'PRODUCT_NOT_FOUND') {
        return { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' };
    }
    if (error?.code === 'INGESTION_SUPERSEDED') {
        return {
            code: 'INGESTION_SUPERSEDED',
            message: 'This import is no longer active.',
        };
    }
    if (
        [
            'PROVIDER_TIMEOUT',
            'PROVIDER_UNAVAILABLE',
            'PROVIDER_RATE_LIMITED',
            'PROVIDER_AUTH_FAILED',
            'UPSTREAM_PROVIDER_ERROR',
            'INVALID_PROVIDER_RESPONSE',
            'INGESTION_NOT_CONFIGURED',
        ].includes(error?.code)
    ) {
        return {
            code: 'UPSTREAM_PROVIDER_ERROR',
            message:
                'Reviews could not be retrieved. Try again later or contact the team.',
        };
    }
    return {
        code: 'INTERNAL_ERROR',
        message: 'The review import could not be completed.',
    };
}

// Called by authenticated controller with verified req.user.uid.
// Source URL is loaded from the owned product, never supplied by the request.
export async function importReviews(uid, productId, options = {}) {
    validateIdentity(uid, productId);
    const database = options.db ?? getDb();
    const fetchReviews = options.fetchReviews ?? fetchCanopyReviews;
    const runRef = database.collection('ingestionRuns').doc();
    const productRef = database.collection('products').doc(productId);

    const source = await database.runTransaction(async (tx) => {
        const product = requireOwner(await tx.get(productRef), uid);
        parseAmazonSource(product.amazonUrl);
        const now = Date.now();
        if (product.activeIngestionRunId && product.ingestionLockUntil > now) {
            throw new AppError(
                409,
                'INGESTION_IN_PROGRESS',
                'An import is already running for this product.'
            );
        }
        // All reads precede writes. Recover an expired lease on the next attempt.
        let oldRef;
        let oldRun;
        if (product.activeIngestionRunId) {
            oldRef = database
                .collection('ingestionRuns')
                .doc(product.activeIngestionRunId);
            const oldSnapshot = await tx.get(oldRef);
            oldRun = oldSnapshot.exists ? oldSnapshot.data() : undefined;
        }
        if (
            oldRun?.userId === uid &&
            oldRun.productId === productId &&
            oldRun.status === 'processing'
        ) {
            tx.update(oldRef, {
                status: 'failed',
                completedAt: FieldValue.serverTimestamp(),
                error: {
                    code: 'INGESTION_INTERRUPTED',
                    message:
                        'The previous import did not complete. Please retry.',
                },
            });
        }
        tx.set(runRef, {
            ingestionRunId: runRef.id,
            userId: uid,
            productId,
            status: 'processing',
            receivedCount: 0,
            acceptedCount: 0,
            rejectedCount: 0,
            savedCount: 0,
            startedAt: FieldValue.serverTimestamp(),
            completedAt: null,
            error: null,
        });
        tx.update(productRef, {
            activeIngestionRunId: runRef.id,
            ingestionLockUntil: now + LEASE_MS,
        });
        return product.amazonUrl;
    });

    let receivedCount = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;
    try {
        // No provider calls inside transactions: Firestore may retry transactions.
        const mapped = await fetchReviews(source);
        const { reviews, rejected } = normalizeReviews(mapped);
        receivedCount = mapped.length;
        acceptedCount = reviews.length;
        rejectedCount = rejected.length;
        if (!reviews.length)
            throw new AppError(
                502,
                'NO_VALID_REVIEWS',
                'No usable reviews returned.'
            );
        const accepted = prepareReviewRecords(reviews);
        const result = {
            ingestionRunId: runRef.id,
            productId,
            status: 'succeeded',
            receivedCount,
            acceptedCount,
            rejectedCount,
            savedCount: accepted.length,
            error: null,
        };
        await database.runTransaction(async (tx) => {
            const product = requireOwner(await tx.get(productRef), uid);
            const run = (await tx.get(runRef)).data();
            if (
                product.activeIngestionRunId !== runRef.id ||
                run?.status !== 'processing'
            ) {
                throw new AppError(
                    409,
                    'INGESTION_SUPERSEDED',
                    'This import is no longer active.'
                );
            }
            stageReviewWrites(tx, database, uid, productId, accepted);
            // Review writes, success status and lock release commit atomically.
            tx.update(runRef, {
                ...result,
                completedAt: FieldValue.serverTimestamp(),
            });
            tx.update(productRef, {
                activeIngestionRunId: FieldValue.delete(),
                ingestionLockUntil: FieldValue.delete(),
            });
        });
        return result;
    } catch (error) {
        const failure = safeFailure(error);
        console.error(
            JSON.stringify({
                event: 'ingestion_failed',
                ingestionRunId: runRef.id,
                productId,
                code: failure.code,
            })
        );
        try {
            const committed = await database.runTransaction(async (tx) => {
                const productSnapshot = await tx.get(productRef);
                const runSnapshot = await tx.get(runRef);
                const product = productSnapshot.exists
                    ? productSnapshot.data()
                    : undefined;
                const run = runSnapshot.exists ? runSnapshot.data() : undefined;
                // Never overwrite an already committed success or another run.
                if (
                    run?.userId === uid &&
                    run.productId === productId &&
                    run.status === 'succeeded'
                ) {
                    return {
                        ingestionRunId: run.ingestionRunId,
                        productId,
                        status: run.status,
                        receivedCount: run.receivedCount,
                        acceptedCount: run.acceptedCount,
                        rejectedCount: run.rejectedCount,
                        savedCount: run.savedCount,
                        error: null,
                    };
                }
                if (
                    run?.userId === uid &&
                    run.productId === productId &&
                    run.status === 'processing'
                ) {
                    tx.update(runRef, {
                        status: 'failed',
                        receivedCount,
                        acceptedCount,
                        rejectedCount,
                        savedCount: 0,
                        completedAt: FieldValue.serverTimestamp(),
                        error: failure,
                    });
                }
                if (
                    product?.userId === uid &&
                    product.activeIngestionRunId === runRef.id
                ) {
                    tx.update(productRef, {
                        activeIngestionRunId: FieldValue.delete(),
                        ingestionLockUntil: FieldValue.delete(),
                    });
                }
            });
            if (committed) return committed;
        } catch {
            console.error(
                JSON.stringify({
                    event: 'ingestion_status_write_failed',
                    ingestionRunId: runRef.id,
                    productId,
                })
            );
            throw new AppError(
                500,
                'INGESTION_STATE_UNAVAILABLE',
                'Import outcome could not be confirmed. Check its status before retrying.'
            );
        }
        const status =
            failure.code === 'UPSTREAM_PROVIDER_ERROR' ||
            failure.code === 'NO_VALID_REVIEWS'
                ? 502
                : failure.code === 'PRODUCT_NOT_FOUND'
                  ? 404
                  : failure.code === 'VALIDATION_ERROR'
                    ? 400
                    : failure.code === 'INGESTION_SUPERSEDED'
                      ? 409
                      : 500;
        throw new AppError(status, failure.code, failure.message);
    }
}

export async function getIngestionRun(uid, productId, ingestionRunId, db) {
    validateIdentity(uid, productId);
    if (
        typeof ingestionRunId !== 'string' ||
        !ingestionRunId.trim() ||
        ingestionRunId.includes('/')
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Invalid ingestion identifier.'
        );
    }
    const database = db ?? getDb();
    await getOwnedProduct(uid, productId, database);
    const snapshot = await database
        .collection('ingestionRuns')
        .doc(ingestionRunId)
        .get();
    const run = snapshot.exists ? snapshot.data() : undefined;
    if (!run || run.userId !== uid || run.productId !== productId) {
        throw new AppError(404, 'INGESTION_NOT_FOUND', 'Import not found.');
    }
    return run;
}

export async function getIngestionRuns(uid, productId, db) {
    validateIdentity(uid, productId);
    const database = db ?? getDb();
    await getOwnedProduct(uid, productId, database);
    const snapshot = await database
        .collection('ingestionRuns')
        .where('userId', '==', uid)
        .where('productId', '==', productId)
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
