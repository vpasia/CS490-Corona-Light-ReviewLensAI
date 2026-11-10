import { expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: jest.fn(),
}));

const { listProducts } = await import('../../src/services/productService.js');

function timestamp(iso) {
    return { toMillis: () => Date.parse(iso), toDate: () => new Date(iso) };
}

function product(productId, userId, productName, createdAt) {
    return {
        productId,
        userId,
        productName,
        platform: 'amazon',
        amazonUrl: `https://www.amazon.com/dp/${productId}`,
        createdAt: timestamp(createdAt),
    };
}

function fakeFirestore(saved = []) {
    const documents = new Map(saved.map((item) => [item.productId, item]));

    return {
        collection(name) {
            if (name !== 'products')
                throw new Error(`Unexpected collection: ${name}`);
            return {
                where(field, operator, value) {
                    if (operator !== '==')
                        throw new Error(`Unexpected operator: ${operator}`);
                    return {
                        async get() {
                            return {
                                docs: [...documents.values()]
                                    .filter((item) => item[field] === value)
                                    .map((item) => ({ data: () => item })),
                            };
                        },
                    };
                },
            };
        },
    };
}

test('returns only the products owned by the signed-in user', async () => {
    const db = fakeFirestore([
        product('p1', 'user-A', 'Echo Dot', '2026-11-01T10:00:00Z'),
        product('p2', 'user-B', 'Private kettle', '2026-11-02T10:00:00Z'),
    ]);

    const products = await listProducts('user-A', db);

    expect(products.map((item) => item.productId)).toEqual(['p1']);
    expect(JSON.stringify(products)).not.toContain('Private kettle');
});

test('returns an empty list when the user has no products', async () => {
    const db = fakeFirestore([
        product('p1', 'user-A', 'Echo Dot', '2026-11-01T10:00:00Z'),
    ]);

    await expect(listProducts('user-C', db)).resolves.toEqual([]);
});

test('returns the newest product first with only public fields', async () => {
    const db = fakeFirestore([
        product('p1', 'user-A', 'Older', '2026-11-01T10:00:00Z'),
        product('p2', 'user-A', 'Newer', '2026-11-03T10:00:00Z'),
    ]);

    const products = await listProducts('user-A', db);

    expect(products.map((item) => item.productId)).toEqual(['p2', 'p1']);
    expect(products[0]).toEqual({
        productId: 'p2',
        productName: 'Newer',
        platform: 'amazon',
        amazonUrl: 'https://www.amazon.com/dp/p2',
        createdAt: '2026-11-03T10:00:00.000Z',
    });
    expect(products[0]).not.toHaveProperty('userId');
});

test.each([undefined, '', ' '])(
    'rejects listing without a verified uid (%s)',
    async (uid) => {
        await expect(listProducts(uid, fakeFirestore())).rejects.toMatchObject({
            status: 401,
            code: 'UNAUTHENTICATED',
        });
    }
);
