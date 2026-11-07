import { expect, test } from '@jest/globals';
import { FieldValue } from 'firebase-admin/firestore';
import { createProduct } from '../../src/services/productService.js';
import { getOwnedProduct } from '../../src/services/ownership.js';

function fakeFirestore() {
    const documents = new Map();
    let nextId = 1;
    const db = {
        collection(name) {
            if (name !== 'products')
                throw new Error(`Unexpected collection: ${name}`);
            return {
                doc(id = `product-${nextId++}`) {
                    return {
                        id,
                        async set(value) {
                            documents.set(id, value);
                        },
                        async get() {
                            return {
                                exists: documents.has(id),
                                data: () => documents.get(id),
                            };
                        },
                    };
                },
            };
        },
    };
    return { db, documents };
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
