import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';
import { getOwnedProduct, requireOwner } from './ownership.js';
import { fetchBrightDataReviews } from './brightDataService.js';
import { normalizeReviews } from './reviewNormalizer.js';
import { prepareReviewRecords, stageReviewWrites } from './reviewWrites.js';
import { validateReviewIdentity as validateIdentity } from './reviewService.js';
import {
    REVIEW_TTL_MS,
    LEASE_MS,
    productAsin,
    isFresh,
    clearLock,
    deduplicateReviews,
    cacheQuery,
    deleteQuery,
} from './reviewCache.js';

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

const response = (run) => ({
    ingestionRunId: run.ingestionRunId,
    productId: run.productId,
    asin: run.asin,
    status: run.status,
    receivedCount: run.receivedCount,
    acceptedCount: run.acceptedCount,
    rejectedCount: run.rejectedCount,
    savedCount: run.savedCount,
    reviewCount: run.reviewCount,
    reused: run.reused,
    error: run.error,
});

// Controllers must pass the verified token UID, never a client-supplied owner.
export async function importReviews(uid, productId, options = {}) {
    validateIdentity(uid, productId);
    const db = options.db ?? getDb();
    const fetchReviews = options.fetchReviews ?? fetchBrightDataReviews;
    const productRef = db.collection('products').doc(productId);
    const runRef = db.collection('ingestionRuns').doc();
    let admission;
    try {
        admission = await db.runTransaction(async (tx) => {
            const product = requireOwner(await tx.get(productRef), uid);
            const asin = productAsin(product);
            const cacheRef = db.collection('reviewCaches').doc(asin);
            const cache = (await tx.get(cacheRef)).data();
            const now = Date.now();
            if (cache?.deleting)
                throw new AppError(
                    409,
                    'REVIEW_CACHE_BUSY',
                    'Review cleanup is in progress. Please retry.'
                );
            if (
                (product.activeIngestionRunId &&
                    product.ingestionLockUntil > now) ||
                (cache?.activeIngestionRunId && cache.ingestionLockUntil > now)
            )
                throw new AppError(
                    409,
                    'INGESTION_IN_PROGRESS',
                    'An import is already running for this product.'
                );
            // Read abandoned runs before writes. Old importers are fenced by the ASIN lease.
            const abandoned = [];
            for (const id of new Set(
                [
                    product.activeIngestionRunId,
                    cache?.activeIngestionRunId,
                ].filter(Boolean)
            )) {
                const ref = db.collection('ingestionRuns').doc(id);
                const data = (await tx.get(ref)).data();
                if (
                    data?.status === 'processing' &&
                    ((data.userId === uid && data.productId === productId) ||
                        data.asin === asin)
                )
                    abandoned.push(ref);
            }
            let cached;
            if (isFresh(cache, now)) {
                const snapshot = await tx.get(
                    cacheQuery(db, asin, cache.version)
                );
                if (snapshot.docs.length === cache.reviewCount) cached = cache;
            }
            for (const ref of abandoned)
                tx.update(ref, {
                    status: 'failed',
                    completedAt: FieldValue.serverTimestamp(),
                    error: {
                        code: 'INGESTION_INTERRUPTED',
                        message:
                            'The previous import did not complete. Please retry.',
                    },
                });
            const run = {
                ingestionRunId: runRef.id,
                userId: uid,
                productId,
                asin,
                status: cached ? 'succeeded' : 'processing',
                receivedCount: 0,
                acceptedCount: 0,
                rejectedCount: 0,
                savedCount: 0,
                reviewCount: cached?.reviewCount ?? 0,
                reused: Boolean(cached),
                startedAt: FieldValue.serverTimestamp(),
                completedAt: cached ? FieldValue.serverTimestamp() : null,
                error: null,
            };
            tx.set(runRef, run);
            if (cached) {
                tx.update(productRef, { asin, ...clearLock() });
                tx.set(cacheRef, { ...clearLock() }, { merge: true });
            } else {
                const lock = {
                    activeIngestionRunId: runRef.id,
                    ingestionLockUntil: now + LEASE_MS,
                };
                tx.update(productRef, { asin, ...lock });
                tx.set(cacheRef, { asin, ...lock }, { merge: true });
            }
            return {
                asin,
                cacheRef,
                oldVersion: cache?.version,
                url: product.amazonUrl,
                cached: cached ? response(run) : null,
            };
        });
    } catch (error) {
        // The cached-success transaction may have committed before its acknowledgement failed.
        const completed = await db.runTransaction(async (tx) => {
            requireOwner(await tx.get(productRef), uid);
            const run = (await tx.get(runRef)).data();
            return run?.userId === uid &&
                run.productId === productId &&
                run.status === 'succeeded'
                ? response(run)
                : null;
        });
        if (completed) return completed;
        throw error;
    }
    if (admission.cached) return admission.cached;
    let receivedCount = 0,
        acceptedCount = 0,
        rejectedCount = 0;
    try {
        const mapped = await fetchReviews(admission.url);
        const normalized = normalizeReviews(mapped);
        receivedCount = mapped.length;
        acceptedCount = normalized.reviews.length;
        rejectedCount = normalized.rejected.length;
        if (!acceptedCount)
            throw new AppError(
                502,
                'NO_VALID_REVIEWS',
                'No usable reviews returned.'
            );
        const accepted = deduplicateReviews(
            prepareReviewRecords(normalized.reviews)
        );
        const result = {
            ingestionRunId: runRef.id,
            productId,
            asin: admission.asin,
            status: 'succeeded',
            receivedCount,
            acceptedCount,
            rejectedCount,
            savedCount: accepted.length,
            reviewCount: accepted.length,
            reused: false,
            error: null,
        };
        await db.runTransaction(async (tx) => {
            const product = requireOwner(await tx.get(productRef), uid);
            const run = (await tx.get(runRef)).data();
            const cache = (await tx.get(admission.cacheRef)).data();
            if (
                productAsin(product) !== admission.asin ||
                product.activeIngestionRunId !== runRef.id ||
                run?.status !== 'processing' ||
                cache?.activeIngestionRunId !== runRef.id ||
                cache.deleting
            )
                throw new AppError(
                    409,
                    'INGESTION_SUPERSEDED',
                    'This import is no longer active.'
                );
            const fetchedAtMs = Date.now();
            stageReviewWrites(
                tx,
                db,
                admission.asin,
                runRef.id,
                accepted,
                fetchedAtMs
            );
            tx.set(
                admission.cacheRef,
                {
                    asin: admission.asin,
                    version: runRef.id,
                    reviewCount: accepted.length,
                    fetchedAtMs,
                    expiresAtMs: fetchedAtMs + REVIEW_TTL_MS,
                    ...clearLock(),
                },
                { merge: true }
            );
            tx.update(runRef, {
                ...result,
                completedAt: FieldValue.serverTimestamp(),
            });
            tx.update(productRef, clearLock());
        });
        // Publish first; only then remove the previous immutable generation.
        // A cleanup failure does not turn an already committed import into a failure.
        if (admission.oldVersion && admission.oldVersion !== runRef.id) {
            try {
                await deleteQuery(
                    db,
                    cacheQuery(db, admission.asin, admission.oldVersion)
                );
            } catch {
                console.warn(
                    JSON.stringify({
                        event: 'review_cleanup_pending',
                        asin: admission.asin,
                        version: admission.oldVersion,
                    })
                );
            }
        }
        return result;
    } catch (error) {
        const failure = safeFailure(error);
        let committed;
        try {
            committed = await db.runTransaction(async (tx) => {
                const product = (await tx.get(productRef)).data();
                const run = (await tx.get(runRef)).data();
                const cache = (await tx.get(admission.cacheRef)).data();
                if (
                    run?.userId === uid &&
                    run.productId === productId &&
                    run.status === 'succeeded'
                )
                    return response(run);
                if (
                    run?.userId === uid &&
                    run.productId === productId &&
                    run.status === 'processing'
                )
                    tx.update(runRef, {
                        status: 'failed',
                        receivedCount,
                        acceptedCount,
                        rejectedCount,
                        savedCount: 0,
                        completedAt: FieldValue.serverTimestamp(),
                        error: failure,
                    });
                if (
                    product?.userId === uid &&
                    product.activeIngestionRunId === runRef.id
                )
                    tx.update(productRef, clearLock());
                if (cache?.activeIngestionRunId === runRef.id)
                    tx.update(admission.cacheRef, clearLock());
            });
        } catch {
            throw new AppError(
                500,
                'INGESTION_STATE_UNAVAILABLE',
                'Import outcome could not be confirmed. Check its status before retrying.'
            );
        }
        if (committed) return committed;
        console.error(
            JSON.stringify({
                event: 'ingestion_failed',
                ingestionRunId: runRef.id,
                productId,
                code: failure.code,
            })
        );
        const status =
            failure.code === 'PRODUCT_NOT_FOUND'
                ? 404
                : failure.code === 'INGESTION_SUPERSEDED'
                  ? 409
                  : failure.code === 'VALIDATION_ERROR'
                    ? 400
                    : ['UPSTREAM_PROVIDER_ERROR', 'NO_VALID_REVIEWS'].includes(
                            failure.code
                        )
                      ? 502
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
