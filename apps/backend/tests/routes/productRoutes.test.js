import { beforeEach, expect, jest, test } from '@jest/globals';
import request from 'supertest';

const documents = new Map();
let nextId = 1;
const verifyIdToken = jest.fn();
const getFirebaseAuth = jest.fn();
const db = {
    batch() {
        const references = [];
        return {
            delete(ref) {
                references.push(ref);
            },
            async commit() {
                for (const ref of references) {
                    await ref.delete();
                }
            },
        };
    },
    collection(name) {
        if (name === 'reviews' || name === 'analyses') {
            const query = {
                where() {
                    return query;
                },
                async get() {
                    return { docs: [] };
                },
            };
            return query;
        }
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
                    async delete() {
                        documents.delete(id);
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
const productInput = {
    productName: 'Example watch',
    amazonUrl: 'https://www.amazon.com/dp/B012345678',
};

beforeEach(() => {
    documents.clear();
    nextId = 1;
    verifyIdToken.mockReset();
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue({ verifyIdToken });
});

test('creates one product owned by the verified user', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });

    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-A')
        .send(productInput);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { productId: 'product-1' } });
    expect(documents.size).toBe(1);
    expect(documents.get('product-1')).toMatchObject({
        productId: 'product-1',
        userId: 'user-A',
        ...productInput,
    });
    expect(verifyIdToken).toHaveBeenCalledWith('token-A');
});

test('returns an owned product to its authenticated owner', async () => {
    documents.set('product-7', {
        productId: 'product-7',
        userId: 'user-A',
        productName: 'Private watch',
        amazonUrl: productInput.amazonUrl,
    });
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });

    const response = await request(app)
        .get('/api/products/product-7')
        .set('Authorization', 'Bearer token-A');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
        data: {
            productId: 'product-7',
            userId: 'user-A',
            productName: 'Private watch',
            amazonUrl: productInput.amazonUrl,
        },
    });
});

test('returns the same 404 for another user’s product and a missing product', async () => {
    documents.set('product-7', { productId: 'product-7', userId: 'user-A' });
    verifyIdToken.mockResolvedValue({ uid: 'user-B' });

    const foreign = await request(app)
        .get('/api/products/product-7')
        .set('Authorization', 'Bearer token-B');
    const missing = await request(app)
        .get('/api/products/missing-id')
        .set('Authorization', 'Bearer token-B');

    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({
        error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found.',
            details: [],
        },
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual(foreign.body);
});

test('rejects a product read without a token', async () => {
    documents.set('product-7', { productId: 'product-7', userId: 'user-A' });

    const response = await request(app).get('/api/products/product-7');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
});

test('rejects a product read with an invalid token', async () => {
    documents.set('product-7', { productId: 'product-7', userId: 'user-A' });
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const response = await request(app)
        .get('/api/products/product-7')
        .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
});

test.each(['get', 'delete'])(
    'rejects a malformed product ID on %s before reaching Firestore',
    async (method) => {
        documents.set('product-7', {
            productId: 'product-7',
            userId: 'user-A',
        });
        verifyIdToken.mockResolvedValue({ uid: 'user-A' });

        const response = await request(app)
            [method]('/api/products/product%2F7')
            .set('Authorization', 'Bearer token-A');

        expect(response.status).toBe(400);
        expect(response.body.error).toEqual({
            code: 'VALIDATION_ERROR',
            message: expect.any(String),
            details: [{ field: 'productId', message: expect.any(String) }],
        });
        expect(documents.has('product-7')).toBe(true);
    }
);

test('user B cannot delete user A’s product after learning its ID', async () => {
    verifyIdToken.mockImplementation(async (token) => ({
        uid: token === 'token-A' ? 'user-A' : 'user-B',
    }));
    const created = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-A')
        .send(productInput);
    const productId = created.body.data.productId;
    const before = documents.get(productId);

    const foreignRead = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', 'Bearer token-B');
    const foreignDelete = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', 'Bearer token-B');
    const ownerRead = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', 'Bearer token-A');

    expect(foreignRead.status).toBe(404);
    expect(foreignRead.body.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(foreignDelete.status).toBe(404);
    expect(foreignDelete.body).toEqual(foreignRead.body);
    expect(documents.get(productId)).toEqual(before);
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body.data).toMatchObject({ productId, userId: 'user-A' });
});

test('deletes an owned product', async () => {
    documents.set('product-7', { productId: 'product-7', userId: 'user-A' });
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });

    const response = await request(app)
        .delete('/api/products/product-7')
        .set('Authorization', 'Bearer token-A');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { productId: 'product-7' } });
    expect(documents.has('product-7')).toBe(false);
});

test('returns the same 404 when deleting a missing product', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });

    const response = await request(app)
        .delete('/api/products/missing-id')
        .set('Authorization', 'Bearer token-A');

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found.',
        details: [],
    });
});

test('rejects a product delete without a token', async () => {
    const response = await request(app).delete('/api/products/product-7');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
});

test('rejects a product delete with an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const response = await request(app)
        .delete('/api/products/product-7')
        .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
});

test('ignores a forged userId and saves the verified user B as owner', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-B' });

    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-B')
        .send({ ...productInput, userId: 'user-A' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { productId: 'product-1' } });
    expect(documents.size).toBe(1);
    expect(documents.get('product-1').userId).toBe('user-B');
    expect(verifyIdToken).toHaveBeenCalledWith('token-B');
});

test.each([
    ['productName', { amazonUrl: productInput.amazonUrl }],
    ['amazonUrl', { productName: productInput.productName }],
])(
    'rejects missing %s with a field error and no write',
    async (field, body) => {
        verifyIdToken.mockResolvedValue({ uid: 'user-A' });

        const response = await request(app)
            .post('/api/products')
            .set('Authorization', 'Bearer token-A')
            .send(body);

        expect(response.status).toBe(400);
        expect(response.body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [{ field, message: expect.any(String) }],
        });
        expect(documents.size).toBe(0);
    }
);

test('rejects a missing token before writing a product', async () => {
    const response = await request(app)
        .post('/api/products')
        .send(productInput);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
        error: {
            code: 'UNAUTHENTICATED',
            message: expect.any(String),
            details: [],
        },
    });
    expect(documents.size).toBe(0);
    expect(verifyIdToken).not.toHaveBeenCalled();
});

test('rejects an invalid token without exposing product data', async () => {
    verifyIdToken.mockRejectedValue(
        new Error('private token verification detail')
    );

    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer invalid-token')
        .send(productInput);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
        error: {
            code: 'UNAUTHENTICATED',
            message: expect.any(String),
            details: [],
        },
    });
    expect(JSON.stringify(response.body)).not.toContain(
        'private token verification detail'
    );
    expect(documents.size).toBe(0);
    expect(verifyIdToken).toHaveBeenCalledWith('invalid-token');
});

test.each([undefined, '', ' '])(
    'rejects verified claims without a usable uid (%s)',
    async (uid) => {
        verifyIdToken.mockResolvedValue({ uid });

        const response = await request(app)
            .post('/api/products')
            .set('Authorization', 'Bearer token-without-uid')
            .send(productInput);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            error: {
                code: 'UNAUTHENTICATED',
                message: expect.any(String),
                details: [],
            },
        });
        expect(documents.size).toBe(0);
    }
);

test('returns a safe 400 for malformed JSON without writing a product', async () => {
    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-A')
        .set('Content-Type', 'application/json')
        .send('{invalid-json');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
        error: {
            code: 'VALIDATION_ERROR',
            message: expect.any(String),
            details: [],
        },
    });
    expect(documents.size).toBe(0);
});

test('returns a safe 413 for oversized JSON without writing a product', async () => {
    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-A')
        .send({
            productName: 'x'.repeat(110_000),
            amazonUrl: productInput.amazonUrl,
        });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
        error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: expect.any(String),
            details: [],
        },
    });
    expect(documents.size).toBe(0);
});

test('returns a safe 500 when Firebase Admin setup fails', async () => {
    getFirebaseAuth.mockImplementation(() => {
        throw new Error('Missing Firebase Admin configuration.');
    });

    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-A')
        .send(productInput);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred.',
            details: [],
        },
    });
    expect(documents.size).toBe(0);
    expect(verifyIdToken).not.toHaveBeenCalled();
});
