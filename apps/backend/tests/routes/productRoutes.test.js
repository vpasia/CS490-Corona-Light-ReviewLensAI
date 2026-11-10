import { beforeEach, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { memoryDb } from '../helpers/memoryDb.js';
let db = memoryDb({ products: {} });
let documents = db.maps.get('products');
const verifyIdToken = jest.fn();
const getFirebaseAuth = jest.fn();

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
    db = memoryDb({ products: {} });
    documents = db.maps.get('products');
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
    expect(response.body).toEqual({ data: { productId: 'auto-1' } });
    expect(documents.size).toBe(1);
    expect(documents.get('auto-1')).toMatchObject({
        productId: 'auto-1',
        userId: 'user-A',
        asin: 'B012345678',
        ...productInput,
    });
    expect(verifyIdToken).toHaveBeenCalledWith('token-A');
});

test('owner can read a target while another user gets the same 404 as a missing ID', async () => {
    documents.set('target-A', { productId: 'target-A', userId: 'user-A' });
    verifyIdToken.mockImplementation(async (token) => ({
        uid: token === 'token-A' ? 'user-A' : 'user-B',
    }));

    const owner = await request(app)
        .get('/api/products/target-A')
        .set('Authorization', 'Bearer token-A');
    const foreign = await request(app)
        .get('/api/products/target-A')
        .set('Authorization', 'Bearer token-B');
    const missing = await request(app)
        .get('/api/products/missing')
        .set('Authorization', 'Bearer token-B');

    expect(owner.status).toBe(200);
    expect(owner.body.data).toMatchObject({ productId: 'target-A' });
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
});

test('foreign delete cannot change a target, review, or ingestion run', async () => {
    const target = {
        productId: 'target-A',
        userId: 'user-A',
        asin: 'B012345678',
        amazonUrl: productInput.amazonUrl,
    };
    documents.set('target-A', target);
    db.maps.set('reviews', new Map([['review-1', { asin: target.asin }]]));
    db.maps.set(
        'ingestionRuns',
        new Map([['run-1', { userId: 'user-A', productId: 'target-A' }]])
    );
    verifyIdToken.mockResolvedValue({ uid: 'user-B' });

    const foreign = await request(app)
        .delete('/api/products/target-A')
        .set('Authorization', 'Bearer token-B');
    const missing = await request(app)
        .delete('/api/products/missing')
        .set('Authorization', 'Bearer token-B');

    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    expect(documents.get('target-A')).toEqual(target);
    expect(db.docs('reviews')).toHaveLength(1);
    expect(db.docs('ingestionRuns')).toHaveLength(1);
});

test('owner delete keeps shared reviews while another target references the ASIN', async () => {
    const asin = 'B012345678';
    documents.set('target-A', {
        productId: 'target-A',
        userId: 'user-A',
        asin,
        amazonUrl: productInput.amazonUrl,
    });
    documents.set('target-B', {
        productId: 'target-B',
        userId: 'user-B',
        asin,
        amazonUrl: productInput.amazonUrl,
    });
    db.maps.set('reviews', new Map([['review-1', { asin }]]));
    db.maps.set(
        'ingestionRuns',
        new Map([
            ['run-A', { userId: 'user-A', productId: 'target-A' }],
            ['run-B', { userId: 'user-B', productId: 'target-B' }],
        ])
    );
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });

    const response = await request(app)
        .delete('/api/products/target-A')
        .set('Authorization', 'Bearer token-A');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { productId: 'target-A' } });
    expect(documents.has('target-A')).toBe(false);
    expect(documents.has('target-B')).toBe(true);
    expect(db.docs('reviews')).toHaveLength(1);
    expect(db.data('ingestionRuns', 'run-A')).toBeUndefined();
    expect(db.data('ingestionRuns', 'run-B')).toBeDefined();
});

test('GET hides a deleting target and DELETE can retry its cleanup', async () => {
    documents.set('target-A', {
        productId: 'target-A',
        userId: 'user-A',
        asin: 'B012345678',
        amazonUrl: productInput.amazonUrl,
        deleting: true,
    });
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });

    const read = await request(app)
        .get('/api/products/target-A')
        .set('Authorization', 'Bearer token-A');
    const deletion = await request(app)
        .delete('/api/products/target-A')
        .set('Authorization', 'Bearer token-A');

    expect(read.status).toBe(404);
    expect(deletion.status).toBe(200);
    expect(documents.has('target-A')).toBe(false);
});

test('owner delete rejects an active import and keeps the target', async () => {
    documents.set('target-A', {
        productId: 'target-A',
        userId: 'user-A',
        asin: 'B012345678',
        amazonUrl: productInput.amazonUrl,
        activeIngestionRunId: 'run-A',
        ingestionLockUntil: Date.now() + 60_000,
    });
    verifyIdToken.mockResolvedValue({ uid: 'user-A' });

    const response = await request(app)
        .delete('/api/products/target-A')
        .set('Authorization', 'Bearer token-A');

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INGESTION_IN_PROGRESS');
    expect(documents.get('target-A').deleting).toBeUndefined();
});

test.each(['get', 'delete'])(
    '%s requires a valid bearer token',
    async (method) => {
        const missing = await request(app)[method]('/api/products/target-A');
        verifyIdToken.mockRejectedValue(new Error('invalid token'));
        const invalid = await request(app)
            [method]('/api/products/target-A')
            .set('Authorization', 'Bearer invalid');
        expect(missing.status).toBe(401);
        expect(invalid.status).toBe(401);
        expect(invalid.body.error.code).toBe('UNAUTHENTICATED');
    }
);

test.each(['get', 'delete'])(
    '%s rejects a decoded product ID containing a slash',
    async (method) => {
        verifyIdToken.mockResolvedValue({ uid: 'user-A' });
        const response = await request(app)
            [method]('/api/products/target%2FA')
            .set('Authorization', 'Bearer token-A');
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
);

test('ignores a forged userId and saves the verified user B as owner', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-B' });

    const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer token-B')
        .send({ ...productInput, userId: 'user-A' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { productId: 'auto-1' } });
    expect(documents.size).toBe(1);
    expect(documents.get('auto-1').userId).toBe('user-B');
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
        expect(response.body).toEqual({ data: { productId: 'auto-1' } });
        expect(documents.size).toBe(1);
        expect(documents.get('auto-1')).toMatchObject({
            productId: 'auto-1',
            userId: 'user-B',
            productName: 'Example watch',
            amazonUrl: url,
        });
    }
);
