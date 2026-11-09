import { beforeEach, expect, jest, test } from '@jest/globals';
import request from 'supertest';

const documents = new Map();
let nextId = 1;
const verifyIdToken = jest.fn();
const getFirebaseAuth = jest.fn();
const db = {
    collection(name) {
        if (name !== 'products')
            throw new Error(`Unexpected collection: ${name}`);
        return {
            doc() {
                const id = `product-${nextId++}`;
                return {
                    id,
                    async set(value) {
                        documents.set(id, value);
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
