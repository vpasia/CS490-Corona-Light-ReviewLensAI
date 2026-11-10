import {
    jest,
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
} from '@jest/globals';
import { memoryDb } from '../helpers/memoryDb.js';
jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: jest.fn(() => {
        throw new Error('Unexpected live access');
    }),
}));
jest.unstable_mockModule('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'SERVER_TIME',
        delete: () => 'DELETE_FIELD',
    },
}));
const { importReviews, getIngestionRun, getIngestionRuns } =
    await import('../../src/services/ingestionService.js');
const { getReviews } = await import('../../src/services/reviewService.js');
const { REVIEW_TTL_MS } = await import('../../src/services/reviewCache.js');
const url = 'https://www.amazon.com/dp/B07PRVS98X',
    asin = 'B07PRVS98X';
const record = {
    text: ' Great sound ',
    rating: '5',
    sourceReviewId: 'R1',
    userId: 'forged',
    productId: 'forged',
};
const setup = () =>
    memoryDb({
        products: {
            A: { userId: 'a', amazonUrl: url, asin },
            B: { userId: 'b', amazonUrl: url, asin },
        },
    });
describe('shared ASIN ingestion', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());
    it('publishes normalized shared reviews, expiry and a private successful run atomically', async () => {
        const db = setup(),
            fetchReviews = jest.fn(async () => [record, null]);
        const result = await importReviews('a', 'A', { db, fetchReviews });
        expect(result).toMatchObject({
            status: 'succeeded',
            receivedCount: 2,
            acceptedCount: 1,
            rejectedCount: 1,
            savedCount: 1,
            reused: false,
        });
        const [review] = db.docs('reviews');
        expect(review).toMatchObject({ text: 'Great sound', rating: 5, asin });
        expect(review.userId).toBeUndefined();
        expect(review.productId).toBeUndefined();
        expect(review.expiresAtMs - review.fetchedAtMs).toBe(REVIEW_TTL_MS);
        expect(
            (await getIngestionRun('a', 'A', result.ingestionRunId, db)).status
        ).toBe('succeeded');
        expect(db.data('products', 'A').activeIngestionRunId).toBeUndefined();
    });
    it('reuses the same fresh generation for another owner without a provider request or expiry extension', async () => {
        const db = setup(),
            fetchReviews = jest.fn(async () => [record]);
        await importReviews('a', 'A', { db, fetchReviews });
        const cache = db.data('reviewCaches', asin);
        const result = await importReviews('b', 'B', { db, fetchReviews });
        expect(result).toMatchObject({
            reused: true,
            savedCount: 0,
            reviewCount: 1,
            status: 'succeeded',
        });
        expect(fetchReviews).toHaveBeenCalledTimes(1);
        expect(db.docs('reviews')).toHaveLength(1);
        expect(db.data('reviewCaches', asin).expiresAtMs).toBe(
            cache.expiresAtMs
        );
        expect(await getReviews('b', 'B', db)).toHaveLength(1);
        await expect(
            getIngestionRun(
                'b',
                'B',
                db.docs('ingestionRuns')[0].ingestionRunId,
                db
            )
        ).rejects.toMatchObject({ code: 'INGESTION_NOT_FOUND' });
    });
    it('deduplicates source IDs and idless content', async () => {
        const db = setup();
        const result = await importReviews('a', 'A', {
            db,
            fetchReviews: async () => [
                record,
                record,
                { text: 'Other', rating: 3 },
                { text: 'Other', rating: 3 },
            ],
        });
        expect(result).toMatchObject({ acceptedCount: 4, savedCount: 2 });
        expect(db.docs('reviews')).toHaveLength(2);
    });
    it('rejects a missing, foreign or deleting product before requesting reviews or creating a run', async () => {
        for (const productId of ['missing', 'B', 'A']) {
            const db = setup(),
                fetchReviews = jest.fn();
            if (productId === 'A')
                await db
                    .collection('products')
                    .doc('A')
                    .update({ deleting: true });
            await expect(
                importReviews('a', productId, { db, fetchReviews })
            ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
            expect(fetchReviews).not.toHaveBeenCalled();
            expect(db.docs('ingestionRuns')).toHaveLength(0);
        }
    });
    it('blocks a concurrent import from a different target with the same ASIN', async () => {
        const db = setup();
        let release, started;
        const ready = new Promise((resolve) => {
            started = resolve;
        });
        const first = importReviews('a', 'A', {
            db,
            fetchReviews: () => {
                started();
                return new Promise((resolve) => {
                    release = resolve;
                });
            },
        });
        await ready;
        const second = jest.fn();
        await expect(
            importReviews('b', 'B', { db, fetchReviews: second })
        ).rejects.toMatchObject({ code: 'INGESTION_IN_PROGRESS' });
        expect(second).not.toHaveBeenCalled();
        release([record]);
        await first;
    });
    it('does not replace an expired dataset if the provider fails', async () => {
        const db = setup();
        await importReviews('a', 'A', {
            db,
            fetchReviews: async () => [record],
        });
        const old = db.data('reviewCaches', asin);
        await db
            .collection('reviewCaches')
            .doc(asin)
            .update({
                fetchedAtMs: Date.now() - REVIEW_TTL_MS - 1000,
                expiresAtMs: Date.now() - 1000,
            });
        await expect(
            importReviews('b', 'B', {
                db,
                fetchReviews: async () => {
                    throw Object.assign(new Error('SECRET'), {
                        code: 'PROVIDER_TIMEOUT',
                    });
                },
            })
        ).rejects.toMatchObject({ code: 'UPSTREAM_PROVIDER_ERROR' });
        expect(db.data('reviewCaches', asin).version).toBe(old.version);
        expect(db.docs('reviews')).toHaveLength(1);
        expect(JSON.stringify(db.docs('ingestionRuns'))).not.toContain(
            'SECRET'
        );
    });
    it('refreshes at expiry and removes the previous generation only after success', async () => {
        const db = setup();
        await importReviews('a', 'A', {
            db,
            fetchReviews: async () => [record],
        });
        const past = Date.now() - REVIEW_TTL_MS;
        await db
            .collection('reviewCaches')
            .doc(asin)
            .update({ fetchedAtMs: past, expiresAtMs: past + REVIEW_TTL_MS });
        const result = await importReviews('b', 'B', {
            db,
            fetchReviews: async () => [{ text: 'Updated', rating: 4 }],
        });
        expect(result.reused).toBe(false);
        expect(db.docs('reviews')).toHaveLength(1);
        expect(db.docs('reviews')[0].text).toBe('Updated');
    });
    it('rejects zero valid reviews and saves a failed run', async () => {
        const db = setup();
        await expect(
            importReviews('a', 'A', { db, fetchReviews: async () => [null] })
        ).rejects.toMatchObject({ code: 'NO_VALID_REVIEWS' });
        expect(db.docs('reviews')).toHaveLength(0);
        expect(db.docs('ingestionRuns')[0].status).toBe('failed');
    });
    it('blocks writes if deletion starts during provider retrieval', async () => {
        const db = setup();
        await expect(
            importReviews('a', 'A', {
                db,
                fetchReviews: async () => {
                    await db
                        .collection('products')
                        .doc('A')
                        .update({ deleting: true });
                    return [record];
                },
            })
        ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
        expect(db.docs('reviews')).toHaveLength(0);
        expect(db.docs('ingestionRuns')[0].status).toBe('failed');
    });
    it('does not recreate products or runs removed during retrieval', async () => {
        const db = setup();
        await expect(
            importReviews('a', 'A', {
                db,
                fetchReviews: async () => {
                    await db.collection('products').doc('A').delete();
                    for (const run of db.docs('ingestionRuns'))
                        await db
                            .collection('ingestionRuns')
                            .doc(run.ingestionRunId)
                            .delete();
                    return [record];
                },
            })
        ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
        expect(db.data('products', 'A')).toBeUndefined();
        expect(db.docs('ingestionRuns')).toHaveLength(0);
    });
    it('fences a superseded ASIN lease', async () => {
        const db = setup();
        await expect(
            importReviews('a', 'A', {
                db,
                fetchReviews: async () => {
                    await db
                        .collection('reviewCaches')
                        .doc(asin)
                        .update({ activeIngestionRunId: 'new-owner' });
                    return [record];
                },
            })
        ).rejects.toMatchObject({ code: 'INGESTION_SUPERSEDED' });
        expect(db.docs('reviews')).toHaveLength(0);
        expect(db.data('reviewCaches', asin).activeIngestionRunId).toBe(
            'new-owner'
        );
    });
    it('does not publish partial reviews when the success commit fails', async () => {
        const db = setup();
        db.controls.failCommit = (writes) =>
            writes.some(
                ([, ref, data]) =>
                    ref.name === 'ingestionRuns' && data?.status === 'succeeded'
            );
        await expect(
            importReviews('a', 'A', { db, fetchReviews: async () => [record] })
        ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        expect(db.docs('reviews')).toHaveLength(0);
        expect(db.docs('ingestionRuns')[0].status).toBe('failed');
    });
    it('recovers an already committed success after a lost acknowledgement', async () => {
        const db = setup();
        db.controls.loseSuccessAck = true;
        expect(
            (
                await importReviews('a', 'A', {
                    db,
                    fetchReviews: async () => [record],
                })
            ).status
        ).toBe('succeeded');
        expect(db.docs('reviews')).toHaveLength(1);
    });
    it('returns explicit uncertainty when failure-state recording is unavailable', async () => {
        const db = setup();
        await expect(
            importReviews('a', 'A', {
                db,
                fetchReviews: async () => {
                    db.controls.failCommit = () => true;
                    throw new Error('unavailable');
                },
            })
        ).rejects.toMatchObject({ code: 'INGESTION_STATE_UNAVAILABLE' });
    });
    it('lists only the requesting owners runs', async () => {
        const db = setup();
        await importReviews('a', 'A', {
            db,
            fetchReviews: async () => [record],
        });
        expect(await getIngestionRuns('a', 'A', db)).toHaveLength(1);
        await expect(getIngestionRuns('b', 'A', db)).rejects.toMatchObject({
            code: 'PRODUCT_NOT_FOUND',
        });
    });
    it('recovers a cached success after acknowledgement loss without fetching again', async () => {
        const db = setup(),
            fetchReviews = jest.fn(async () => [record]);
        await importReviews('a', 'A', { db, fetchReviews });
        db.controls.loseSuccessAck = true;
        const result = await importReviews('b', 'B', { db, fetchReviews });
        expect(result.reused).toBe(true);
        expect(fetchReviews).toHaveBeenCalledTimes(1);
    });
    it('recovers expired ASIN leases and records the interrupted run', async () => {
        const db = setup();
        await db
            .collection('reviewCaches')
            .doc(asin)
            .set({ asin, activeIngestionRunId: 'old', ingestionLockUntil: 1 });
        await db.collection('ingestionRuns').doc('old').set({
            ingestionRunId: 'old',
            userId: 'b',
            productId: 'B',
            asin,
            status: 'processing',
        });
        await importReviews('a', 'A', {
            db,
            fetchReviews: async () => [record],
        });
        expect(db.data('ingestionRuns', 'old')).toMatchObject({
            status: 'failed',
            error: { code: 'INGESTION_INTERRUPTED' },
        });
    });
    it('does not bypass an incomplete cache and pretend it was reused', async () => {
        const db = setup();
        await importReviews('a', 'A', {
            db,
            fetchReviews: async () => [record],
        });
        await db
            .collection('reviews')
            .doc(db.docs('reviews')[0].reviewId)
            .delete();
        const fetchReviews = jest.fn(async () => [record]);
        expect(
            (await importReviews('b', 'B', { db, fetchReviews })).reused
        ).toBe(false);
        expect(fetchReviews).toHaveBeenCalledTimes(1);
    });
    it('rejects batches exceeding the supported review limit without publishing', async () => {
        const db = setup();
        await expect(
            importReviews('a', 'A', {
                db,
                fetchReviews: async () =>
                    Array.from({ length: 401 }, (_, i) => ({
                        ...record,
                        sourceReviewId: `R${i}`,
                    })),
            })
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(db.docs('reviews')).toHaveLength(0);
    });
    it('records success even if cleanup of the obsolete generation must be retried later', async () => {
        const db = setup();
        await importReviews('a', 'A', {
            db,
            fetchReviews: async () => [record],
        });
        await db
            .collection('reviewCaches')
            .doc(asin)
            .update({ expiresAtMs: 0 });
        db.controls.failBatch = true;
        expect(
            (
                await importReviews('b', 'B', {
                    db,
                    fetchReviews: async () => [{ text: 'Updated', rating: 4 }],
                })
            ).status
        ).toBe('succeeded');
        expect((await getReviews('b', 'B', db))[0].text).toBe('Updated');
    });
    it('keeps cleanup locks intact when import is attempted during last-reference deletion', async () => {
        const db = setup();
        await db
            .collection('reviewCaches')
            .doc(asin)
            .set({ deleting: true, cleanupProductId: 'other' });
        const fetchReviews = jest.fn();
        await expect(
            importReviews('a', 'A', { db, fetchReviews })
        ).rejects.toMatchObject({ code: 'REVIEW_CACHE_BUSY' });
        expect(fetchReviews).not.toHaveBeenCalled();
        expect(db.docs('ingestionRuns')).toHaveLength(0);
    });
    it('publishes a supported 400-review dataset with matching counts', async () => {
        const db = setup();
        const result = await importReviews('a', 'A', {
            db,
            fetchReviews: async () =>
                Array.from({ length: 400 }, (_, i) => ({
                    ...record,
                    sourceReviewId: `R${i}`,
                })),
        });
        expect(result.savedCount).toBe(400);
        expect(await getReviews('a', 'A', db)).toHaveLength(400);
    });
});
