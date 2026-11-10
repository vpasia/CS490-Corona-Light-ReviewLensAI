import { jest, describe, it, expect } from '@jest/globals';
import { memoryDb } from '../helpers/memoryDb.js';
jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: () => {
        throw new Error('Unexpected live access');
    },
}));
jest.unstable_mockModule('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'SERVER_TIME',
        delete: () => 'DELETE_FIELD',
    },
}));
const { getReviews, saveReviews } =
    await import('../../src/services/reviewService.js');
const { REVIEW_TTL_MS } = await import('../../src/services/reviewCache.js');
const asin = 'B07PRVS98X',
    url = `https://www.amazon.com/dp/${asin}`;
function setup() {
    const now = Date.now();
    return memoryDb({
        products: {
            A: { userId: 'a', amazonUrl: url, asin },
            B: { userId: 'b', amazonUrl: url, asin },
        },
        reviewCaches: {
            [asin]: {
                asin,
                version: 'v1',
                fetchedAtMs: now,
                expiresAtMs: now + REVIEW_TTL_MS,
                reviewCount: 1,
            },
        },
        reviews: {
            R1: {
                asin,
                cacheVersion: 'v1',
                text: 'Shared public review',
                rating: 4,
            },
            R2: {
                asin,
                cacheVersion: 'old',
                text: 'Old generation',
                rating: 3,
            },
        },
    });
}
describe('owned access to shared reviews', () => {
    it('returns only the published generation to either legitimate owner', async () => {
        const db = setup();
        expect(await getReviews('a', 'A', db)).toEqual(
            await getReviews('b', 'B', db)
        );
        expect(await getReviews('a', 'A', db)).toHaveLength(1);
    });
    it('hides foreign, missing and deleting targets', async () => {
        const db = setup();
        for (const id of ['B', 'missing'])
            await expect(getReviews('a', id, db)).rejects.toMatchObject({
                code: 'PRODUCT_NOT_FOUND',
            });
        await db.collection('products').doc('A').update({ deleting: true });
        await expect(getReviews('a', 'A', db)).rejects.toMatchObject({
            code: 'PRODUCT_NOT_FOUND',
        });
    });
    it('returns no stale cache as fresh data', async () => {
        const db = setup();
        await db
            .collection('reviewCaches')
            .doc(asin)
            .update({ expiresAtMs: 0 });
        expect(await getReviews('a', 'A', db)).toEqual([]);
    });
    it('reports an incomplete cache instead of pretending import succeeded', async () => {
        const db = setup();
        await db.collection('reviews').doc('R1').delete();
        await expect(getReviews('a', 'A', db)).rejects.toMatchObject({
            code: 'REVIEW_CACHE_INCOMPLETE',
        });
    });
    it('validates identity before database resolution', async () => {
        await expect(getReviews('', 'A')).rejects.toMatchObject({
            code: 'UNAUTHENTICATED',
        });
        await expect(getReviews('a', 'bad/id')).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
        });
    });
    it('prevents obsolete direct saves from bypassing atomic cache publication', async () => {
        await expect(saveReviews('a', 'A', [])).rejects.toMatchObject({
            code: 'USE_INGESTION_SERVICE',
        });
    });
});
