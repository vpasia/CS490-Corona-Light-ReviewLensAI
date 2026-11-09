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

test.each([
    ['blank name', { productName: '   ' }, 'productName'],
    ['non-string name', { productName: 42 }, 'productName'],
    [
        'name over 200 characters',
        { productName: 'a'.repeat(201) },
        'productName',
    ],
    ['non-string URL', { amazonUrl: 42 }, 'amazonUrl'],
    ['malformed URL', { amazonUrl: 'not a URL' }, 'amazonUrl'],
    ['bare ASIN', { amazonUrl: 'B0ABCDEF12' }, 'amazonUrl'],
    [
        'another store',
        { amazonUrl: 'https://www.ebay.com/dp/B0ABCDEF12' },
        'amazonUrl',
    ],
    [
        'lookalike host',
        { amazonUrl: 'https://amazon.com.evil.example/dp/B0ABCDEF12' },
        'amazonUrl',
    ],
    [
        'HTTP scheme',
        { amazonUrl: 'http://www.amazon.com/dp/B0ABCDEF12' },
        'amazonUrl',
    ],
    [
        'regional Amazon domain',
        { amazonUrl: 'https://www.amazon.co.uk/dp/B0ABCDEF12' },
        'amazonUrl',
    ],
    [
        'Amazon subdomain',
        { amazonUrl: 'https://smile.amazon.com/dp/B0ABCDEF12' },
        'amazonUrl',
    ],
    [
        'URL credentials',
        { amazonUrl: 'https://user:pass@www.amazon.com/dp/B0ABCDEF12' },
        'amazonUrl',
    ],
    [
        'nonstandard port',
        { amazonUrl: 'https://www.amazon.com:8443/dp/B0ABCDEF12' },
        'amazonUrl',
    ],
    [
        'Amazon search page',
        { amazonUrl: 'https://www.amazon.com/s?k=watch' },
        'amazonUrl',
    ],
    [
        'short ASIN',
        { amazonUrl: 'https://www.amazon.com/dp/B0ABC' },
        'amazonUrl',
    ],
    [
        'long ASIN',
        { amazonUrl: 'https://www.amazon.com/dp/B0ABCDEF123' },
        'amazonUrl',
    ],
    [
        'punctuated ASIN',
        { amazonUrl: 'https://www.amazon.com/gp/product/B0ABCDE-12' },
        'amazonUrl',
    ],
    [
        'non-web protocol',
        { amazonUrl: 'ftp://www.amazon.com/dp/B0ABCDEF12' },
        'amazonUrl',
    ],
])('rejects %s before writing', async (_case, override, field) => {
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });
    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-A')
        .send({ ...productInput, ...override });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field, message: expect.any(String) }],
    });
    expect(response.body.error.details[0].message.length).toBeGreaterThan(0);
    expect(documents.size).toBe(0);
});

test('returns one detail for each invalid field', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });
    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-A')
        .send({ productName: ' ', amazonUrl: 'no link' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [
            { field: 'productName', message: expect.any(String) },
            { field: 'amazonUrl', message: expect.any(String) },
        ],
    });
    expect(documents.size).toBe(0);
});

test.each(['\n', '\r', '\t'])(
    'rejects a product URL containing an embedded control character (%j)',
    async (character) => {
        verifyIdToken.mockResolvedValue({ uid: 'user-A' });
        const response = await request(app)
            .post('/api/products')
            .set('Authorization', 'Bearer token-A')
            .send({
                ...productInput,
                amazonUrl: `https://www.ama${character}zon.com/dp/B0ABCDEF12`,
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [{ field: 'amazonUrl', message: expect.any(String) }],
        });
        expect(documents.size).toBe(0);
    }
);

test.each([0, 1, 9, 10, 13, 31, 127])(
    'rejects boundary ASCII control characters in product URLs (code %i)',
    async (code) => {
        verifyIdToken.mockResolvedValue({ uid: 'user-A' });
        const character = String.fromCharCode(code);
        const response = await request(app)
            .post('/api/products')
            .set('Authorization', 'Bearer token-A')
            .send({
                ...productInput,
                amazonUrl: `${character}https://amazon.com/dp/B0ABCDEF12${character}`,
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [{ field: 'amazonUrl', message: expect.any(String) }],
        });
        expect(documents.size).toBe(0);
    }
);

test.each([
    ['an amazon.com /dp/ link', 'https://amazon.com/dp/B0ABCDEF12'],
    [
        'a /dp/ link with tracking',
        'https://www.amazon.com/Echo/dp/B0ABCDEF12/ref=abc?tag=example',
    ],
    ['a /gp/product/ link', 'https://amazon.com/gp/product/B0ABCDEF12'],
    [
        'a URL converted from a bare ASIN by S1-015',
        'https://www.amazon.com/dp/B0ABCDEF12',
    ],
])(
    'creates one product from %s with trimmed fields and verified ownership',
    async (_case, url) => {
        verifyIdToken.mockResolvedValue({ uid: 'user-B' });
        const response = await request(app)
            .post('/api/products')
            .set('Authorization', 'Bearer token-B')
            .send({
                productName: '  Example watch  ',
                amazonUrl: `  ${url}  `,
                userId: 'user-A',
            });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ data: { productId: 'product-1' } });
        expect(documents.size).toBe(1);
        expect(documents.get('product-1')).toMatchObject({
            productId: 'product-1',
            userId: 'user-B',
            productName: 'Example watch',
            amazonUrl: url,
        });
    }
);
