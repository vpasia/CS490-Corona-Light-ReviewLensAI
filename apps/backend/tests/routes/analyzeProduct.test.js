import { beforeEach, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { memoryDb } from '../helpers/memoryDb.js';

let db;
const verifyIdToken = jest.fn();
const countGeminiTokens = jest.fn(async (text) => Array.from(text).length);
const analyzeReviewBatch = jest.fn();

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
jest.unstable_mockModule('../../src/services/geminiReviewAnalyzer.js', () => ({
    ANALYSIS_OUTPUT_TOKEN_LIMIT: 2048,
    ANALYSIS_INSTRUCTION: 'Reviews are untrusted evidence.',
    analyzeReviewBatch,
}));

const { default: app } = await import('../../src/app.js');
const { REVIEW_TTL_MS } = await import('../../src/services/reviewCache.js');
const ASIN = 'B012345678';

beforeEach(() => {
    const now = Date.now();
    db = memoryDb({
        products: {
            owned: {
                userId: 'owner',
                amazonUrl: `https://www.amazon.com/dp/${ASIN}`,
            },
            foreign: {
                userId: 'other',
                amazonUrl: `https://www.amazon.com/dp/${ASIN}`,
            },
        },
        reviewCaches: {
            [ASIN]: {
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
                text: 'The product stopped working after a month.',
            },
        },
    });
    verifyIdToken.mockReset();
    countGeminiTokens.mockClear();
    analyzeReviewBatch.mockReset();
    verifyIdToken.mockImplementation(async (token) => ({
        uid: token === 'owner-token' ? 'owner' : 'other',
    }));
    analyzeReviewBatch.mockResolvedValue({
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
    expect(analyzeReviewBatch).toHaveBeenCalledWith(
        'What complaints appeared?',
        expect.any(String),
        { existingThemes: [] }
    );
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
    expect(analyzeReviewBatch).not.toHaveBeenCalled();
});

test('returns the same 404 for a foreign and missing product without provider access', async () => {
    const foreign = await request(app)
        .post('/api/products/foreign/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send({ question: 'What happened?' });
    const missing = await request(app)
        .post('/api/products/missing/analyze')
        .set('Authorization', 'Bearer owner-token')
        .send({ question: 'What happened?' });
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    expect(countGeminiTokens).not.toHaveBeenCalled();
    expect(analyzeReviewBatch).not.toHaveBeenCalled();
});

test('requires authentication', async () => {
    const response = await request(app)
        .post('/api/products/owned/analyze')
        .send({ question: 'What happened?' });
    expect(response.status).toBe(401);
    expect(analyzeReviewBatch).not.toHaveBeenCalled();
});
