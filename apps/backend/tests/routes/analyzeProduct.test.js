import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { memoryDb } from '../helpers/memoryDb.js';

let db;
const verifyIdToken = jest.fn();
const countGeminiTokens = jest.fn(async (text) => Array.from(text).length);
const fetchGemini = jest.fn();

jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: () => db,
    getFirebaseAuth: () => ({ verifyIdToken }),
}));
jest.unstable_mockModule('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'SERVER_TIME',
        delete: () => 'DELETE_FIELD',
    },
}));
jest.unstable_mockModule('../../src/services/geminiTokenCounter.js', () => ({
    countGeminiTokens,
}));

const { default: app } = await import('../../src/app.js');
const { REVIEW_TTL_MS } = await import('../../src/services/reviewCache.js');
const ASIN = 'B012345678';
const FOREIGN_ASIN = 'B07PRVS98X';
const OWNED_REVIEW = 'The product stopped working after a month.';
const FOREIGN_REVIEW = 'The copper hinge rattled after one train ride.';
const entityScopeCases = JSON.parse(
    readFileSync(
        new URL('../fixtures/reviewQaEntityScope.json', import.meta.url)
    )
);

function mockAnalysis(result) {
    fetchGemini.mockResolvedValue({
        ok: true,
        json: async () => ({
            candidates: [
                {
                    finishReason: 'STOP',
                    content: { parts: [{ text: JSON.stringify(result) }] },
                },
            ],
        }),
    });
}

beforeEach(() => {
    jest.replaceProperty(process, 'env', {
        ...process.env,
        GEMINI_API_KEY: 'test-key',
    });
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchGemini);
    const now = Date.now();
    db = memoryDb({
        products: {
            owned: {
                userId: 'owner',
                productName: 'SoundTrail H1 Headphones',
                platform: 'amazon',
                amazonUrl: `https://www.amazon.com/dp/${ASIN}`,
            },
            foreign: {
                userId: 'other',
                productName: 'SoundTrail H2 Headphones',
                platform: 'amazon',
                amazonUrl: `https://www.amazon.com/dp/${FOREIGN_ASIN}`,
            },
        },
        reviewCaches: {
            [ASIN]: {
                version: 'active',
                reviewCount: 1,
                fetchedAtMs: now,
                expiresAtMs: now + REVIEW_TTL_MS,
            },
            [FOREIGN_ASIN]: {
                version: 'active',
                reviewCount: 1,
                fetchedAtMs: now,
                expiresAtMs: now + REVIEW_TTL_MS,
            },
        },
        reviews: {
            saved: {
                asin: ASIN,
                cacheVersion: 'active',
                rating: 2,
                text: OWNED_REVIEW,
            },
            'foreign-review': {
                asin: FOREIGN_ASIN,
                cacheVersion: 'active',
                rating: 3,
                text: FOREIGN_REVIEW,
            },
        },
    });
    verifyIdToken.mockReset();
    countGeminiTokens.mockClear();
    fetchGemini.mockReset();
    verifyIdToken.mockImplementation(async (token) => ({
        uid: token === 'owner-token' ? 'owner' : 'other',
    }));
    mockAnalysis({
        outOfScope: false,
        reviews: [
            {
                reviewId: 'saved',
                partIndex: 0,
                themes: [
                    {
                        theme: 'stopped working',
                        kind: 'complaint',
                        evidenceRelation: 'direct',
                        stance: 'not_applicable',
                        excerpt: 'stopped working',
                    },
                ],
            },
        ],
    });
});

afterEach(() => jest.restoreAllMocks());

test('returns a grounded answer for an owned active product', async () => {
    const response = await request(app)
        .post('/api/products/owned/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send({
            question: ' What complaints appeared? ',
            userId: 'other',
            asin: 'B000000000',
        });
    expect(response.status).toBe(200);
    expect(response.body.data.answer).toContain('1 of 1 saved review');
    expect(fetchGemini).toHaveBeenCalledTimes(1);
    const [, providerRequest] = fetchGemini.mock.calls[0];
    const body = JSON.parse(providerRequest.body);
    expect(body.systemInstruction.parts[0].text).toContain(
        'general-knowledge questions'
    );
    expect(body.systemInstruction.parts[1].text).toBe(
        'Active target: {"productName":"SoundTrail H1 Headphones","platform":"amazon"}'
    );
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({
        question: 'What complaints appeared?',
        existingThemes: [],
        evidence: {
            reviews: [
                {
                    reviewId: 'saved',
                    rating: 2,
                    text: OWNED_REVIEW,
                },
            ],
        },
    });
});

test('returns an insufficient-evidence answer as a normal success', async () => {
    mockAnalysis({
        outOfScope: false,
        reviews: [{ reviewId: 'saved', partIndex: 0, themes: [] }],
    });
    const question = 'Is the parking lot safe at night?';
    const response = await request(app)
        .post('/api/products/owned/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send({ question });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
        data: { answer: expect.stringContaining('0 of 1 saved review') },
    });
    expect(response.body.data.answer).toContain(question);
});

test.each([
    'What is the weather today?',
    'Will I need an umbrella this afternoon?',
    'Who is the President of the United States?',
    'Who currently holds the office of U.S. president?',
    'Write a Python sorting algorithm.',
    'Show me how to order a list of numbers in Python.',
    'What are the best restaurants in New York?',
    'Where should I book dinner in NYC?',
])('returns a normal scope refusal for %s', async (question) => {
    mockAnalysis({
        outOfScope: true,
        reviews: [{ reviewId: 'saved', partIndex: 0, themes: [] }],
    });
    const response = await request(app)
        .post('/api/products/owned/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send({ question });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
        answer: expect.stringContaining('supplied reviews'),
        outOfScope: true,
    });
});

test('rejects a provider scope refusal that also reports findings', async () => {
    mockAnalysis({
        outOfScope: true,
        reviews: [
            {
                reviewId: 'saved',
                partIndex: 0,
                themes: [
                    {
                        theme: 'stopped working',
                        kind: 'complaint',
                        evidenceRelation: 'direct',
                        stance: 'not_applicable',
                        excerpt: 'stopped working',
                    },
                ],
            },
        ],
    });
    const response = await request(app)
        .post('/api/products/owned/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send({ question: 'What is the weather today?' });
    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('UPSTREAM_PROVIDER_ERROR');
});

test.each([
    {},
    { question: 12 },
    { question: '   ' },
    { question: 'x'.repeat(1001) },
])('rejects an invalid question before provider access', async (body) => {
    const response = await request(app)
        .post('/api/products/owned/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send(body);
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'question' }],
    });
    expect(countGeminiTokens).not.toHaveBeenCalled();
    expect(fetchGemini).not.toHaveBeenCalled();
});

test('returns the same 404 for a foreign and missing product without provider access', async () => {
    const collection = jest.spyOn(db, 'collection');
    const foreign = await request(app)
        .post('/api/products/foreign/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send({
            question: 'What did SoundTrail H2 reviewers say about its hinges?',
            userId: 'other',
            asin: FOREIGN_ASIN,
        });
    const missing = await request(app)
        .post('/api/products/missing/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send({ question: 'What happened?' });
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    expect(collection.mock.calls).toEqual([['products'], ['products']]);
    expect(countGeminiTokens).not.toHaveBeenCalled();
    expect(fetchGemini).not.toHaveBeenCalled();
});

test.each(entityScopeCases)(
    'uses the owned dataset and scope rules for $name',
    async ({ question, expected_result_kind }) => {
        const outOfScope = expected_result_kind === 'out_of_scope';
        if (outOfScope) {
            mockAnalysis({
                outOfScope: true,
                reviews: [{ reviewId: 'saved', partIndex: 0, themes: [] }],
            });
        }
        const response = await request(app)
            .post('/api/products/owned/analyze')
            .set('Authorization', 'Bearer owner-token')
            .send({ question, userId: 'other', asin: FOREIGN_ASIN });

        expect(response.status).toBe(200);
        if (outOfScope) {
            expect(response.body.data).toEqual({
                answer: expect.stringContaining('supplied reviews'),
                outOfScope: true,
            });
        } else {
            expect(response.body.data).toEqual({
                answer: expect.stringContaining('stopped working'),
            });
        }
        expect(fetchGemini).toHaveBeenCalledTimes(1);
        const [, providerRequest] = fetchGemini.mock.calls[0];
        const body = JSON.parse(providerRequest.body);
        expect(body.systemInstruction.parts[0].text).toContain(
            'requests about another product, entity, or platform'
        );
        expect(body.systemInstruction.parts[0].text).toContain(
            'Decline comparisons that require evidence from outside the active dataset.'
        );
        expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({
            question,
            existingThemes: [],
            evidence: {
                reviews: [{ reviewId: 'saved', rating: 2, text: OWNED_REVIEW }],
            },
        });
        expect(providerRequest.body).not.toContain(FOREIGN_REVIEW);
        expect(response.body.data.answer).not.toContain(FOREIGN_REVIEW);
    }
);

test('lets the other authenticated owner analyze their own dataset only', async () => {
    mockAnalysis({
        outOfScope: false,
        reviews: [{ reviewId: 'foreign-review', partIndex: 0, themes: [] }],
    });
    const response = await request(app)
        .post('/api/products/foreign/analyze')
        .set('Authorization', 'Bearer other-token')
        .send({ question: 'What complaints appeared?' });
    expect(response.status).toBe(200);
    expect(fetchGemini).toHaveBeenCalledTimes(1);
    const [, providerRequest] = fetchGemini.mock.calls[0];
    const body = JSON.parse(providerRequest.body);
    expect(body.systemInstruction.parts[1].text).toBe(
        'Active target: {"productName":"SoundTrail H2 Headphones","platform":"amazon"}'
    );
    expect(JSON.parse(body.contents[0].parts[0].text).evidence).toEqual({
        reviews: [
            { reviewId: 'foreign-review', rating: 3, text: FOREIGN_REVIEW },
        ],
    });
    expect(providerRequest.body).not.toContain(OWNED_REVIEW);
});

test('requires authentication', async () => {
    const response = await request(app)
        .post('/api/products/owned/analyze')
        .send({ question: 'What happened?' });
    expect(response.status).toBe(401);
    expect(fetchGemini).not.toHaveBeenCalled();
});
