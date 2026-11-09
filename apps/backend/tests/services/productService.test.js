import { expect, test, jest } from '@jest/globals';
import { FieldValue } from 'firebase-admin/firestore';

jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: jest.fn(),
}));

const { createProduct, deleteProduct } =
    await import('../../src/services/productService.js');

const { getOwnedProduct } = await import('../../src/services/ownership.js');

function fakeFirestore({ failBatchNumber } = {}) {
    const documents = new Map();
    const reviews = new Map();
    const analyses = new Map();
    const collections = { products: documents, reviews, analyses };
    let nextId = 1;
    let batchCommits = 0;
    const db = {
        batch() {
            const deletions = [];
            return {
                delete(ref) {
                    deletions.push(ref);
                },
                async commit() {
                    batchCommits++;
                    if (batchCommits === failBatchNumber)
                        throw new Error('batch delete failed');
                    for (const ref of deletions) {
                        collections[ref.collectionName].delete(ref.id);
                    }
                },
            };
        },
        collection(name) {
            const stored = collections[name];
            if (!stored) throw new Error(`Unexpected collection: ${name}`);
            return {
                doc(id = `product-${nextId++}`) {
                    return {
                        id,
                        collectionName: name,
                        async set(value) {
                            stored.set(id, value);
                        },
                        async get() {
                            return {
                                exists: stored.has(id),
                                data: () => stored.get(id),
                            };
                        },
                    };
                },
                where(field, operator, value) {
                    if (operator !== '==')
                        throw new Error('Unexpected query operator');
                    const filters = [[field, value]];
                    const query = {
                        where(nextField, nextOperator, nextValue) {
                            if (nextOperator !== '==')
                                throw new Error('Unexpected query operator');
                            filters.push([nextField, nextValue]);
                            return query;
                        },
                        async get() {
                            return {
                                docs: [...stored.entries()]
                                    .filter(([, data]) =>
                                        filters.every(
                                            ([key, expected]) =>
                                                data[key] === expected
                                        )
                                    )
                                    .map(([id]) => ({
                                        ref: db.collection(name).doc(id),
                                    })),
                            };
                        },
                    };
                    return query;
                },
            };
        },
    };
    return { db, documents, reviews, analyses };
}

test('creates one owned Amazon product with its source URL', async () => {
    const { db, documents } = fakeFirestore();
    const productId = await createProduct(
        'user-A',
        {
            productName: 'Example watch',
            amazonUrl: 'https://www.amazon.com/dp/B012345678',
        },
        db
    );

    expect(productId).toBe('product-1');
    expect(documents.size).toBe(1);
    const saved = documents.get(productId);
    expect(saved).toEqual({
        productId: 'product-1',
        userId: 'user-A',
        productName: 'Example watch',
        platform: 'amazon',
        amazonUrl: 'https://www.amazon.com/dp/B012345678',
        createdAt: expect.any(FieldValue),
    });
    expect(saved.createdAt.isEqual(FieldValue.serverTimestamp())).toBe(true);
});

test.each([
    [
        'missing uid',
        '',
        'Example watch',
        'https://www.amazon.com/dp/B012345678',
    ],
    ['missing name', 'user-A', ' ', 'https://www.amazon.com/dp/B012345678'],
    ['missing URL', 'user-A', 'Example watch', ' '],
])(
    'rejects %s without writing a product',
    async (_case, uid, productName, amazonUrl) => {
        const { db, documents } = fakeFirestore();

        await expect(
            createProduct(uid, { productName, amazonUrl }, db)
        ).rejects.toThrow();
        expect(documents.size).toBe(0);
    }
);

test('ignores ownership and metadata supplied in product input', async () => {
    const { db, documents } = fakeFirestore();
    const productId = await createProduct(
        'user-B',
        {
            productName: 'Example watch',
            amazonUrl: 'https://www.amazon.com/dp/B012345678',
            userId: 'user-A',
            productId: 'forged-id',
            platform: 'other',
            createdAt: 'forged-time',
        },
        db
    );

    const saved = documents.get(productId);
    expect(saved.userId).toBe('user-B');
    expect(saved.productId).toBe('product-1');
    expect(saved.platform).toBe('amazon');
    expect(saved.createdAt.isEqual(FieldValue.serverTimestamp())).toBe(true);
});

test('retrieves the saved product for its owner', async () => {
    const { db, documents } = fakeFirestore();
    const saved = {
        productId: 'product-7',
        userId: 'user-A',
        productName: 'Example watch',
        platform: 'amazon',
        amazonUrl: 'https://www.amazon.com/dp/B012345678',
        createdAt: 'saved-time',
    };
    documents.set('product-7', saved);

    await expect(getOwnedProduct('user-A', 'product-7', db)).resolves.toEqual(
        saved
    );
});

test.each([
    ['missing product', 'missing-id'],
    ["another user's product", 'product-7'],
])('returns the same 404 for %s', async (_case, productId) => {
    const { db, documents } = fakeFirestore();
    documents.set('product-7', {
        productId: 'product-7',
        userId: 'user-A',
        productName: 'Private watch',
    });

    await expect(
        getOwnedProduct('user-B', productId, db)
    ).rejects.toMatchObject({
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found.',
    });
});

test('gives two users separate products for the same Amazon URL', async () => {
    const { db, documents } = fakeFirestore();
    const input = {
        productName: 'Example watch',
        amazonUrl: 'https://www.amazon.com/dp/B012345678',
    };

    const firstId = await createProduct('user-A', input, db);
    const secondId = await createProduct('user-B', input, db);

    expect(firstId).not.toBe(secondId);
    expect(documents.get(firstId).userId).toBe('user-A');
    expect(documents.get(secondId).userId).toBe('user-B');
});

test.each([undefined, ''])(
    'rejects retrieval without a verified uid (%s)',
    async (uid) => {
        const { db, documents } = fakeFirestore();
        documents.set('product-7', { productId: 'product-7', userId: uid });

        await expect(
            getOwnedProduct(uid, 'product-7', db)
        ).rejects.toMatchObject({
            status: 401,
            code: 'UNAUTHENTICATED',
        });
    }
);

test('deletes an owned product and only its matching reviews and analyses', async () => {
    const { db, documents, reviews, analyses } = fakeFirestore();
    documents.set('product-A', { productId: 'product-A', userId: 'user-A' });
    documents.set('product-B', { productId: 'product-B', userId: 'user-B' });
    reviews.set('review-A', { userId: 'user-A', productId: 'product-A' });
    reviews.set('review-other-product', {
        userId: 'user-A',
        productId: 'product-B',
    });
    reviews.set('review-other-user', {
        userId: 'user-B',
        productId: 'product-A',
    });
    analyses.set('analysis-A', { userId: 'user-A', productId: 'product-A' });
    analyses.set('analysis-other', {
        userId: 'user-B',
        productId: 'product-A',
    });

    await expect(deleteProduct('user-A', 'product-A', db)).resolves.toBe(
        'product-A'
    );

    expect(documents.has('product-A')).toBe(false);
    expect(documents.has('product-B')).toBe(true);
    expect([...reviews.keys()]).toEqual([
        'review-other-product',
        'review-other-user',
    ]);
    expect([...analyses.keys()]).toEqual(['analysis-other']);
});

test('rejects another user’s delete without changing the product or children', async () => {
    const { db, documents, reviews } = fakeFirestore();
    const product = { productId: 'product-A', userId: 'user-A' };
    documents.set('product-A', product);
    reviews.set('review-A', { userId: 'user-A', productId: 'product-A' });

    await expect(
        deleteProduct('user-B', 'product-A', db)
    ).rejects.toMatchObject({
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
    });

    expect(documents.get('product-A')).toEqual(product);
    expect(reviews.has('review-A')).toBe(true);
});

test('keeps the product and children when the first deletion batch fails', async () => {
    const { db, documents, reviews } = fakeFirestore({ failBatchNumber: 1 });
    documents.set('product-A', { productId: 'product-A', userId: 'user-A' });
    reviews.set('review-A', { userId: 'user-A', productId: 'product-A' });

    await expect(deleteProduct('user-A', 'product-A', db)).rejects.toThrow(
        'batch delete failed'
    );

    expect(documents.has('product-A')).toBe(true);
    expect(reviews.has('review-A')).toBe(true);
});

test('can retry after a later deletion batch fails', async () => {
    const { db, documents, reviews, analyses } = fakeFirestore({
        failBatchNumber: 2,
    });
    documents.set('product-A', { productId: 'product-A', userId: 'user-A' });
    for (let index = 0; index < 401; index++) {
        reviews.set(`review-${index}`, {
            userId: 'user-A',
            productId: 'product-A',
        });
    }
    analyses.set('analysis-A', { userId: 'user-A', productId: 'product-A' });

    await expect(deleteProduct('user-A', 'product-A', db)).rejects.toThrow(
        'batch delete failed'
    );
    expect(documents.has('product-A')).toBe(true);
    expect(reviews.size).toBe(1);
    expect(analyses.has('analysis-A')).toBe(true);

    await expect(deleteProduct('user-A', 'product-A', db)).resolves.toBe(
        'product-A'
    );
    expect(documents.has('product-A')).toBe(false);
    expect(reviews.size).toBe(0);
    expect(analyses.size).toBe(0);
});
