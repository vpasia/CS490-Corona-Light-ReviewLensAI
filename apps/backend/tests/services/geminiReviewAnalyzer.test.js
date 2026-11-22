import { describe, expect, it, jest } from '@jest/globals';
import { analyzeReviewBatch } from '../../src/services/geminiReviewAnalyzer.js';

const finding = {
    reviewId: 'saved-1',
    partIndex: 0,
    themes: [
        {
            theme: 'stopped working',
            kind: 'complaint',
            evidenceRelation: 'direct',
            stance: 'not_applicable',
            excerpt: 'stopped after a month',
        },
    ],
};

function response(value, finishReason = 'STOP') {
    return {
        ok: true,
        json: async () => ({
            candidates: [
                {
                    finishReason,
                    content: {
                        parts: [
                            {
                                text: JSON.stringify({
                                    outOfScope: false,
                                    ...value,
                                }),
                            },
                        ],
                    },
                },
            ],
        }),
    };
}

describe('Gemini review analysis', () => {
    it('uses the analysis model, separate instructions, and structured JSON', async () => {
        const fetchImpl = jest
            .fn()
            .mockResolvedValue(response({ reviews: [finding] }));
        const result = await analyzeReviewBatch(
            'What failed?',
            '{"reviews":[]}',
            {
                existingThemes: ['stopped working'],
                apiKey: 'fake-key',
                fetchImpl,
            }
        );
        expect(result).toEqual({ outOfScope: false, reviews: [finding] });
        const [url, request] = fetchImpl.mock.calls[0];
        expect(url).toContain('/models/gemini-3.6-flash:generateContent');
        expect(request.headers['x-goog-api-key']).toBe('fake-key');
        const body = JSON.parse(request.body);
        expect(body.systemInstruction.parts[0].text).toContain('untrusted');
        expect(body.contents[0].parts[0].text).toContain('What failed?');
        expect(body.contents[0].parts[0].text).toContain('stopped working');
        expect(body.generationConfig.responseMimeType).toBe('application/json');
        expect(body.generationConfig.responseJsonSchema).toBeDefined();
        const themeSchema =
            body.generationConfig.responseJsonSchema.properties.reviews.items
                .properties.themes.items;
        expect(themeSchema.required).toEqual(
            expect.arrayContaining(['evidenceRelation', 'stance'])
        );
        expect(themeSchema.properties.evidenceRelation.enum).toEqual([
            'direct',
            'related',
        ]);
        expect(body.systemInstruction.parts[2].text).toMatch(/direct|related/i);
        expect(body.systemInstruction.parts[2].text).toMatch(/absent|none/i);
        expect(body.generationConfig.responseJsonSchema.required).toContain(
            'outOfScope'
        );
        expect(body.generationConfig.maxOutputTokens).toBe(2048);
    });

    it('requires a server key before sending reviews', async () => {
        const fetchImpl = jest.fn();
        await expect(
            analyzeReviewBatch('Question', 'fake review', {
                apiKey: '',
                fetchImpl,
            })
        ).rejects.toMatchObject({ code: 'GEMINI_NOT_CONFIGURED', status: 503 });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
        [{ ok: false, status: 429 }, 'HTTP failure'],
        [response({ reviews: [] }, 'MAX_TOKENS'), 'truncated response'],
        [
            response({ reviews: [], outOfScope: undefined }),
            'missing scope flag',
        ],
        [
            { ok: true, json: async () => ({ candidates: [] }) },
            'missing candidate',
        ],
        [
            {
                ok: true,
                json: async () => ({
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: '{' }] },
                        },
                    ],
                }),
            },
            'malformed JSON',
        ],
    ])('returns a safe error for %s (%s)', async (providerResponse) => {
        await expect(
            analyzeReviewBatch('Question', 'fake review', {
                apiKey: 'fake-key',
                fetchImpl: jest.fn().mockResolvedValue(providerResponse),
            })
        ).rejects.toMatchObject({
            code: 'UPSTREAM_PROVIDER_ERROR',
            status: 502,
        });
    });

    it('does not expose the key or review text on a transport failure', async () => {
        const error = await analyzeReviewBatch(
            'Question',
            'private fake review',
            {
                apiKey: 'fake-key',
                fetchImpl: jest
                    .fn()
                    .mockRejectedValue(
                        new Error('fake-key private fake review')
                    ),
            }
        ).catch((failure) => failure);
        expect(error.message).not.toContain('fake-key');
        expect(error.message).not.toContain('private fake review');
    });
});
