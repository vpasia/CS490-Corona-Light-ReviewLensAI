import { describe, it, expect, jest } from '@jest/globals';
import { countGeminiTokens } from '../../src/services/geminiTokenCounter.js';

describe('Gemini token counting', () => {
    it('counts the exact text supplied for the analysis model', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ totalTokens: 17 }),
        });
        expect(
            await countGeminiTokens('Saved review evidence', {
                apiKey: 'fake-key',
                fetchImpl,
            })
        ).toBe(17);
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:countTokens',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': 'fake-key',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: 'Saved review evidence' }],
                        },
                    ],
                }),
            })
        );
    });

    it('requires a backend key before calling the provider', async () => {
        const fetchImpl = jest.fn();
        await expect(
            countGeminiTokens('Review text', { apiKey: '', fetchImpl })
        ).rejects.toMatchObject({ code: 'GEMINI_NOT_CONFIGURED', status: 503 });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
        {
            response: { ok: false, status: 429 },
            code: 'UPSTREAM_PROVIDER_ERROR',
        },
        {
            response: { ok: true, json: async () => ({ totalTokens: -1 }) },
            code: 'UPSTREAM_PROVIDER_ERROR',
        },
    ])(
        'returns a safe $code for provider failures',
        async ({ response, code }) => {
            await expect(
                countGeminiTokens('private fake review', {
                    apiKey: 'fake-key',
                    fetchImpl: jest.fn().mockResolvedValue(response),
                })
            ).rejects.toMatchObject({ code, status: 502 });
        }
    );

    it('returns a safe error for network failure or timeout', async () => {
        for (const fetchImpl of [
            jest.fn().mockRejectedValue(new Error('private fake review')),
            jest.fn().mockImplementation(() => new Promise(() => {})),
        ]) {
            await expect(
                countGeminiTokens('private fake review', {
                    apiKey: 'fake-key',
                    fetchImpl,
                    timeoutMs: 1,
                })
            ).rejects.toMatchObject({
                code: 'UPSTREAM_PROVIDER_ERROR',
                status: 502,
            });
        }
    });

    it('does not expose review text or key material in a provider error', async () => {
        const error = await countGeminiTokens('private fake review', {
            apiKey: 'fake-key',
            fetchImpl: jest
                .fn()
                .mockRejectedValue(new Error('fake-key private fake review')),
        }).catch((failure) => failure);
        expect(error.message).not.toContain('private fake review');
        expect(error.message).not.toContain('fake-key');
    });
});
