import assert from 'node:assert/strict';
import { describe, it } from '@jest/globals';
import {
    fetchSerpApiReviews,
    mapSerpApiReview,
} from '../../src/services/serpApiService.js';

const source = 'https://www.amazon.com/dp/B012345678';

const options = {
    apiKey: 'test-key',
    totalTimeoutMs: 5000,
    maxReviews: 15,
};

const response = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const productPayload = (overrides = {}) => ({
    authors_reviews: [
        {
            text: 'A useful review',
            rating: 5,
            author: 'Reader',
            date: 'January 1, 2026',
            verified_purchase: true,
        },
    ],
    other_countries_reviews: [
        {
            text: 'A review from another country',
            rating: 4,
            author: 'Another reader',
            date: 'February 1, 2026',
            verified_purchase: false,
        },
    ],
    reviews_information: {
        summary: {
            insights: [
                {
                    examples: [
                        { snippet: 'A recurring positive theme' },
                        { snippet: 'Another customer observation' },
                    ],
                },
            ],
        },
    },
    ...overrides,
});

describe('SerpAPI review mapping', () => {
    it('maps SerpAPI review fields for normalization', () => {
        assert.deepEqual(
            mapSerpApiReview({
                text: ' Good sound ',
                rating: 5,
                author: 'Reader',
                date: 'January 1, 2026',
                verified_purchase: true,
            }),
            {
                text: ' Good sound ',
                rating: 5,
                reviewerName: 'Reader',
                reviewData: 'January 1, 2026',
                isVerifiedPurchase: true,
            }
        );
    });

    it('uses defaults for missing optional review fields', () => {
        const mapped = mapSerpApiReview({ text: 'A review' });

        assert.equal(mapped.text, 'A review');
        assert.equal(mapped.reviewerName, '');
        assert.equal(mapped.reviewData, '');
        assert.equal(mapped.isVerifiedPurchase, true);
        assert.ok(mapped.rating >= 3 && mapped.rating <= 5);
    });

    it('drops malformed individual records', () => {
        assert.equal(mapSerpApiReview(null), null);
        assert.equal(mapSerpApiReview(undefined), null);
        assert.equal(mapSerpApiReview([]), null);
        assert.equal(mapSerpApiReview('not a review'), null);
    });
});

describe('SerpAPI review fetching', () => {
    it('rejects unsupported Amazon URLs before making a provider call', async () => {
        for (const url of [
            'bad',
            'https://amazon.com.evil.test/dp/B012345678',
            'http://amazon.com/dp/B012345678',
            'https://user:pass@amazon.com/dp/B012345678',
            'https://amazon.com/',
            'https://amazon.co.uk/dp/B012345678',
        ]) {
            let called = false;

            await assert.rejects(
                fetchSerpApiReviews(url, {
                    ...options,
                    fetchImpl: async () => {
                        called = true;
                        return response(productPayload());
                    },
                }),
                { code: 'INVALID_AMAZON_URL' }
            );

            assert.equal(called, false);
        }
    });

    it('requests the Amazon product from SerpAPI with the ASIN and API key', async () => {
        const records = await fetchSerpApiReviews(source, {
            ...options,
            fetchImpl: async (url, init) => {
                const parsed = new URL(url);

                assert.equal(parsed.origin, 'https://serpapi.com');
                assert.equal(parsed.pathname, '/search.json');
                assert.equal(parsed.searchParams.get('engine'), 'amazon_product');
                assert.equal(parsed.searchParams.get('asin'), 'B012345678');
                assert.equal(parsed.searchParams.get('api_key'), 'test-key');

                assert.equal(init.method, 'GET');
                assert.ok(init.signal instanceof AbortSignal);
                assert.equal(init.redirect, 'error');

                return response({
                    authors_reviews: [{ text: 'Review R1', rating: 5 }],
                    other_countries_reviews: [],
                    reviews_information: {
                        summary: {
                            insights: [],
                        },
                    },
                });
            },
        });

        assert.deepEqual(records, [
            { text: 'Review R1', rating: 5 },
        ]);
    });

    it('combines author reviews, international reviews, and insight snippets', async () => {
        const payload = productPayload();

        const records = await fetchSerpApiReviews(source, {
            ...options,
            fetchImpl: async () => response(payload),
        });

        assert.equal(records.length, 4);

        assert.deepEqual(records.slice(0, 2), [
            payload.authors_reviews[0],
            payload.other_countries_reviews[0],
        ]);

        assert.deepEqual(records.slice(2), [
            { text: 'A recurring positive theme' },
            { text: 'Another customer observation' },
        ]);
    });

    it('accepts an empty set of provider review collections', async () => {
        const records = await fetchSerpApiReviews(source, {
            ...options,
            fetchImpl: async () => response({
                authors_reviews: [],
                other_countries_reviews: [],
                reviews_information: {
                    summary: {
                        insights: [],
                    },
                },
            }),
        });

        assert.deepEqual(records, []);
    });

    it('requires the server API key without making a request', async () => {
        for (const apiKey of ['', '   ', null]) {
            await assert.rejects(
                fetchSerpApiReviews(source, {
                    ...options,
                    apiKey,
                    fetchImpl: async () => assert.fail('must not request'),
                }),
                { code: 'INGESTION_NOT_CONFIGURED' }
            );
        }
    });

    it('uses the environment API key when no key is passed explicitly', async () => {
        const previousKey = process.env.SERPAPI_KEY;
        process.env.SERPAPI_KEY = 'environment-key';

        try {
            await fetchSerpApiReviews(source, {
                totalTimeoutMs: 5000,
                fetchImpl: async (url) => {
                    assert.equal(
                        new URL(url).searchParams.get('api_key'),
                        'environment-key'
                    );

                    return response({
                        authors_reviews: [],
                        other_countries_reviews: [],
                        reviews_information: {
                            summary: {
                                insights: [],
                            },
                        },
                    });
                },
            });
        } finally {
            if (previousKey === undefined) {
                delete process.env.SERPAPI_KEY;
            } else {
                process.env.SERPAPI_KEY = previousKey;
            }
        }
    });

    it('rejects invalid configuration before making a request', async () => {
        const invalidOptions = [
            { totalTimeoutMs: 0 },
            { totalTimeoutMs: 120001 },
            { maxReviews: 14 },
            { maxReviews: 10001 },
            { fetchImpl: null },
        ];

        for (const invalid of invalidOptions) {
            await assert.rejects(
                fetchSerpApiReviews(source, {
                    ...options,
                    ...invalid,
                    fetchImpl: 'fetchImpl' in invalid
                        ? invalid.fetchImpl
                        : async () => assert.fail('must not request'),
                }),
                TypeError
            );
        }
    });

    it('maps HTTP errors without exposing provider response details', async () => {
        for (const [status, code] of [
            [429, 'PROVIDER_RATE_LIMITED'],
            [401, 'PROVIDER_AUTH_FAILED'],
            [403, 'PROVIDER_AUTH_FAILED'],
            [500, 'UPSTREAM_PROVIDER_ERROR'],
        ]) {
            await assert.rejects(
                fetchSerpApiReviews(source, {
                    ...options,
                    fetchImpl: async () =>
                        response(
                            { error: 'secret provider detail' },
                            status
                        ),
                }),
                (error) => {
                    assert.equal(error.code, code);
                    assert.equal(error.message.includes('secret'), false);
                    return true;
                }
            );
        }
    });

    it('handles network failures without exposing provider details', async () => {
        await assert.rejects(
            fetchSerpApiReviews(source, {
                ...options,
                fetchImpl: async () => {
                    throw new Error('secret network detail');
                },
            }),
            (error) => {
                assert.equal(error.code, 'PROVIDER_UNAVAILABLE');
                assert.equal(error.message.includes('secret'), false);
                return true;
            }
        );
    });

    it('rejects invalid provider JSON', async () => {
        await assert.rejects(
            fetchSerpApiReviews(source, {
                ...options,
                fetchImpl: async () => ({
                    ok: true,
                    status: 200,
                    json: async () => {
                        throw new Error('secret invalid JSON detail');
                    },
                }),
            }),
            (error) => {
                assert.equal(error.code, 'INVALID_PROVIDER_RESPONSE');
                assert.equal(error.message.includes('secret'), false);
                return true;
            }
        );
    });

    it('aborts the provider request when the total timeout expires', async () => {
        await assert.rejects(
            fetchSerpApiReviews(source, {
                ...options,
                totalTimeoutMs: 25,
                fetchImpl: (_url, init) =>
                    new Promise((resolve, reject) => {
                        init.signal.addEventListener(
                            'abort',
                            () => reject(new Error('aborted')),
                            { once: true }
                        );
                    }),
            }),
            { code: 'PROVIDER_TIMEOUT' }
        );
    });
});