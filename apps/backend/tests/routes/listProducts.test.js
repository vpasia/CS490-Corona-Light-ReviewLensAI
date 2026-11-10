import { beforeEach, expect, jest, test } from '@jest/globals';
import request from 'supertest';

const documents = new Map();
const verifyIdToken = jest.fn();
const getFirebaseAuth = jest.fn();
const db = {
    collection(name) {
        if (name !== 'products')
            throw new Error(`Unexpected collection: ${name}`);
        return {
            where(field, operator, value) {
                return {
                    async get() {
                        return {
                            docs: [...documents.values()]
                                .filter(
                                    (item) =>
                                        operator === '==' &&
                                        item[field] === value
                                )
                                .map((item) => ({ data: () => item })),
                        };
                    },
                };
            },
        };
    },
};

jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: () => db,
    getFirebaseAuth,
}));

const { default: app } = await import('../../src/app.js');

function seedProduct(productId, userId, productName) {
    documents.set(productId, {
        productId,
        userId,
        productName,
        platform: 'amazon',
        amazonUrl: `https://www.amazon.com/dp/${productId}`,
        createdAt: {
            toMillis: () => 1,
            toDate: () => new Date('2026-11-01T10:00:00Z'),
        },
    });
}

beforeEach(() => {
    documents.clear();
    verifyIdToken.mockReset();
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue({ verifyIdToken });
    seedProduct('product-1', 'user-A', 'Echo Dot');
    seedProduct('product-2', 'user-B', 'Private kettle');
});

test('lists only the verified user’s products in the standard list format', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });

    const response = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer token-A');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
        data: [
            {
                productId: 'product-1',
                productName: 'Echo Dot',
                platform: 'amazon',
                amazonUrl: 'https://www.amazon.com/dp/product-1',
                createdAt: '2026-11-01T10:00:00.000Z',
            },
        ],
        nextCursor: null,
        count: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain('Private kettle');
    expect(verifyIdToken).toHaveBeenCalledWith('token-A');
});

test('never shows user A’s products to user B', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-B' });

    const response = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer token-B');

    expect(response.status).toBe(200);
    expect(response.body.data.map((item) => item.productName)).toEqual([
        'Private kettle',
    ]);
    expect(JSON.stringify(response.body)).not.toContain('Echo Dot');
});

test('ignores a userId supplied in the query string', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-B' });

    const response = await request(app)
        .get('/api/products?userId=user-A')
        .set('Authorization', 'Bearer token-B');

    expect(response.status).toBe(200);
    expect(response.body.data.map((item) => item.productName)).toEqual([
        'Private kettle',
    ]);
});

test('returns an empty list for a user with no products', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-C' });

    const response = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer token-C');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [], nextCursor: null, count: 0 });
});

test('rejects a missing token without exposing any products', async () => {
    const response = await request(app).get('/api/products');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
        error: {
            code: 'UNAUTHENTICATED',
            message: expect.any(String),
            details: [],
        },
    });
    expect(JSON.stringify(response.body)).not.toContain('Echo Dot');
    expect(verifyIdToken).not.toHaveBeenCalled();
});

test('rejects an invalid token without exposing any products', async () => {
    verifyIdToken.mockRejectedValue(new Error('private verification detail'));

    const response = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toContain('Echo Dot');
    expect(JSON.stringify(response.body)).not.toContain(
        'private verification detail'
    );
});
