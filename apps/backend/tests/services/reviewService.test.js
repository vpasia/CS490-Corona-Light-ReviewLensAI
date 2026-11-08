import { describe, it, expect, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: jest.fn(() => {
        throw new Error('Unexpected live database access');
    }),
}));
// Keep these tests completely isolated from Firebase SDK initialization.
jest.unstable_mockModule('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));
const { saveReviews, getReviews } =
    await import('../../src/services/reviewService.js');

function fakeFirestore() {
    const products = new Map([
        ['product-A', { userId: 'user-A' }],
        ['product-A2', { userId: 'user-A' }],
        ['product-B', { userId: 'user-B' }],
    ]);
    const reviews = new Map();
    let sequence = 0;
    const state = { commits: 0, reviewReads: 0, failCommit: false };
    const db = {
        collection(name) {
            if (name === 'products')
                return {
                    doc(id) {
                        return {
                            async get() {
                                return {
                                    exists: products.has(id),
                                    data: () => products.get(id),
                                };
                            },
                        };
                    },
                };
            if (name !== 'reviews') throw new Error('Unexpected collection');
            function query(filters = []) {
                return {
                    where(field, operator, value) {
                        expect(operator).toBe('==');
                        return query([...filters, [field, value]]);
                    },
                    async get() {
                        state.reviewReads++;
                        return {
                            docs: [...reviews.entries()]
                                .filter(([, value]) =>
                                    filters.every(
                                        ([key, expected]) =>
                                            value[key] === expected
                                    )
                                )
                                .map(([id, value]) => ({
                                    id,
                                    data: () => value,
                                })),
                        };
                    },
                };
            }
            return { ...query(), doc: () => ({ id: `review-${++sequence}` }) };
        },
        batch() {
            const pending = [];
            return {
                set(ref, value) {
                    pending.push([ref.id, value]);
                },
                async commit() {
                    state.commits++;
                    if (state.failCommit)
                        throw new Error('Database unavailable');
                    for (const [id, value] of pending) reviews.set(id, value);
                },
            };
        },
    };
    return { db, products, reviews, state };
}
const validReview = {
    text: 'Good sound.',
    rating: 5,
    sourceReviewId: 'source-1',
};

describe('owned review persistence', () => {
    it('saves and retrieves normalized fields with backend ownership and IDs', async () => {
        const { db, reviews } = fakeFirestore();
        const result = await saveReviews(
            'user-A',
            'product-A',
            [validReview],
            db
        );
        expect(result).toEqual({ reviewIds: ['review-1'], count: 1 });
        expect(reviews.get('review-1')).toEqual({
            ...validReview,
            reviewId: 'review-1',
            userId: 'user-A',
            productId: 'product-A',
            createdAt: 'SERVER_TIMESTAMP',
        });
        expect(await getReviews('user-A', 'product-A', db)).toEqual([
            reviews.get('review-1'),
        ]);
    });
    it('strips forged ownership, IDs, timestamps and unsupported fields', async () => {
        const { db, reviews } = fakeFirestore();
        await saveReviews(
            'user-A',
            'product-A',
            [
                {
                    ...validReview,
                    userId: 'user-B',
                    productId: 'product-B',
                    reviewId: 'forged',
                    createdAt: 'forged',
                    secret: 'discard',
                },
            ],
            db
        );
        expect(reviews.get('review-1')).toEqual({
            ...validReview,
            reviewId: 'review-1',
            userId: 'user-A',
            productId: 'product-A',
            createdAt: 'SERVER_TIMESTAMP',
        });
    });
    it('keeps two targets owned by the same user separate', async () => {
        const { db } = fakeFirestore();
        await saveReviews('user-A', 'product-A', [validReview], db);
        await saveReviews(
            'user-A',
            'product-A2',
            [{ text: 'Other product.', rating: 2 }],
            db
        );
        const list = await getReviews('user-A', 'product-A2', db);
        expect(list).toHaveLength(1);
        expect(list[0].text).toBe('Other product.');
        expect(list[0].productId).toBe('product-A2');
    });
    it('filters children by both owner and product, even if a child has an incorrect link', async () => {
        const { db, reviews } = fakeFirestore();
        await saveReviews('user-A', 'product-A', [validReview], db);
        reviews.set('foreign', {
            text: 'Private',
            rating: 1,
            userId: 'user-B',
            productId: 'product-A',
        });
        const list = await getReviews('user-A', 'product-A', db);
        expect(list).toHaveLength(1);
        expect(list[0].userId).toBe('user-A');
    });
    it.each(['product-A', 'missing-product'])(
        'returns 404 for foreign/missing target %s before any review access',
        async (id) => {
            const { db, state, reviews } = fakeFirestore();
            await expect(
                saveReviews('user-B', id, [validReview], db)
            ).rejects.toMatchObject({ status: 404, code: 'PRODUCT_NOT_FOUND' });
            await expect(getReviews('user-B', id, db)).rejects.toMatchObject({
                status: 404,
                code: 'PRODUCT_NOT_FOUND',
            });
            expect(state.commits).toBe(0);
            expect(state.reviewReads).toBe(0);
            expect(reviews.size).toBe(0);
        }
    );
    it.each([undefined, '', ' '])(
        'rejects absent identity (%s) without initializing Firebase',
        async (uid) => {
            await expect(
                saveReviews(uid, 'product-A', [validReview])
            ).rejects.toMatchObject({ status: 401 });
            await expect(getReviews(uid, 'product-A')).rejects.toMatchObject({
                status: 401,
            });
        }
    );
    it.each([undefined, '', 'nested/product'])(
        'rejects invalid product ID (%s)',
        async (id) => {
            await expect(
                saveReviews('user-A', id, [validReview])
            ).rejects.toMatchObject({ status: 400 });
            await expect(getReviews('user-A', id)).rejects.toMatchObject({
                status: 400,
            });
        }
    );
    it.each(
        [
            null,
            {},
            [null],
            [validReview, { text: '', rating: 5 }],
            [{ text: 'Bad', rating: 6 }],
        ].map((records) => [records])
    )(
        'rejects malformed input without partial writes (%j)',
        async (records) => {
            const { db, state, reviews } = fakeFirestore();
            await expect(
                saveReviews('user-A', 'product-A', records, db)
            ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
            expect(state.commits).toBe(0);
            expect(reviews.size).toBe(0);
        }
    );
    it('handles empty input and results while still checking ownership', async () => {
        const { db, state } = fakeFirestore();
        expect(await saveReviews('user-A', 'product-A', [], db)).toEqual({
            reviewIds: [],
            count: 0,
        });
        expect(await getReviews('user-A', 'product-A', db)).toEqual([]);
        await expect(
            saveReviews('user-B', 'product-A', [], db)
        ).rejects.toMatchObject({ status: 404 });
        expect(state.commits).toBe(0);
    });
    it('rejects oversized batches before writing', async () => {
        const { db, state } = fakeFirestore();
        await expect(
            saveReviews('user-A', 'product-A', Array(401).fill(validReview), db)
        ).rejects.toMatchObject({ status: 400 });
        expect(state.commits).toBe(0);
    });
    it('propagates commit failure instead of returning a successful save count', async () => {
        const { db, state, reviews } = fakeFirestore();
        state.failCommit = true;
        await expect(
            saveReviews('user-A', 'product-A', [validReview], db)
        ).rejects.toThrow('Database unavailable');
        expect(reviews.size).toBe(0);
    });
});
