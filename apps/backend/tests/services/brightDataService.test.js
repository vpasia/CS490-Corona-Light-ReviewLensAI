
import assert from 'node:assert/strict';
import { describe, it } from '@jest/globals';
import {
    fetchBrightDataReviews,
    mapBrightDataReview,
    mapBrightDataReviews,
} from '../../src/services/brightDataService.js';

const source = 'https://www.amazon.com/dp/B012345678';

const options = {
    apiKey: 'test-key',
    datasetId: 'test-dataset',
    totalTimeoutMs: 5000,
    pollIntervalMs: 100,
};

const review = (id, extra = {}) => ({
    review_id: id,
    review_text: `Review ${id}`,
    rating: 4,
    ...extra,
});

const response = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const serveDirect = (payload, inspectRequest) => async (url, init) => {
    inspectRequest?.(url, init);
    return response(payload);
};

describe('Bright Data review service', () => {
    it('maps Bright Data review fields for normalization', () => {
        assert.deepEqual(
            mapBrightDataReview({
                review_id: 'R1',
                review_text: ' Good sound ',
                rating: 5,
                review_title: 'Nice',
                author_name: 'Reader',
                verified_purchase: true,
            }),
            {
                text: ' Good sound ',
                rating: 5,
                sourceReviewId: 'R1',
                title: 'Nice',
                reviewerName: 'Reader',
                isVerifiedPurchase: true,
            }
        );
    });

    it('supports documented field aliases', () => {
        assert.deepEqual(
            mapBrightDataReview({
                id: 'R2',
                body: 'Clear picture',
                title: 'Great',
                reviewer_name: 'Reviewer',
                verifiedPurchase: false,
            }),
            {
                text: 'Clear picture',
                rating: undefined,
                sourceReviewId: 'R2',
                title: 'Great',
                reviewerName: 'Reviewer',
                isVerifiedPurchase: false,
            }
        );
    });

    it('drops malformed individual records', () => {
        assert.equal(mapBrightDataReview(null), null);
        assert.equal(mapBrightDataReview([]), null);

        assert.deepEqual(mapBrightDataReviews([review('A'), null, []]), [
            {
                text: 'Review A',
                rating: 4,
                sourceReviewId: 'A',
                title: undefined,
                reviewerName: undefined,
                isVerifiedPurchase: undefined,
            },
        ]);
    });

    it('accepts supported provider collection shapes', () => {
        const expected = [
            {
                text: 'Review A',
                rating: 4,
                sourceReviewId: 'A',
                title: undefined,
                reviewerName: undefined,
                isVerifiedPurchase: undefined,
            },
        ];

        assert.deepEqual(mapBrightDataReviews([review('A')]), expected);
        assert.deepEqual(
            mapBrightDataReviews({ data: [review('A')] }),
            expected
        );
        assert.deepEqual(
            mapBrightDataReviews({ results: [review('A')] }),
            expected
        );
    });

    it('rejects missing or unsupported review collections', () => {
        for (const payload of [
            {},
            null,
            { errors: [{ message: 'secret provider detail' }] },
            { data: { reviews: [review('A')] } },
        ]) {
            assert.throws(
                () => mapBrightDataReviews(payload),
                { code: 'INVALID_PROVIDER_RESPONSE' }
            );
        }
    });

    it('returns an empty list for an empty provider collection', () => {
        assert.deepEqual(mapBrightDataReviews([]), []);
        assert.deepEqual(mapBrightDataReviews({ data: [] }), []);
        assert.deepEqual(mapBrightDataReviews({ results: [] }), []);
    });

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
                fetchBrightDataReviews(url, {
                    ...options,
                    fetchImpl: async () => {
                        called = true;
                        return response([]);
                    },
                }),
                { code: 'INVALID_AMAZON_URL' }
            );

            assert.equal(called, false);
        }
    });

    it('triggers the configured Bright Data dataset with credentials in the header', async () => {
        const records = await fetchBrightDataReviews(source, {
            ...options,
            fetchImpl: serveDirect([review('R1')], (url, init) => {
                const parsed = new URL(url);

                assert.equal(parsed.origin, 'https://api.brightdata.com');
                assert.equal(parsed.pathname, '/datasets/v3/trigger');
                assert.equal(
                    parsed.searchParams.get('dataset_id'),
                    'test-dataset'
                );
                assert.equal(parsed.searchParams.get('format'), 'json');
                assert.equal(url.includes(options.apiKey), false);

                assert.equal(init.method, 'POST');
                assert.equal(init.headers.Authorization, 'Bearer test-key');
                assert.equal(
                    init.headers['Content-Type'],
                    'application/json'
                );
                assert.equal(init.redirect, 'error');

                const body = JSON.parse(init.body);

                assert.deepEqual(body, [
                    {
                        url: source,
                        reviews_to_not_include: [],
                        max_reviews: 15,
                    },
                ]);
            }),
        });

        assert.equal(records.length, 1);
        assert.equal(records[0].text, 'Review R1');
    });

    it('allows maxReviews to be configured in the trigger payload', async () => {
        await fetchBrightDataReviews(source, {
            ...options,
            maxReviews: 25,
            fetchImpl: serveDirect([], (_url, init) => {
                assert.equal(JSON.parse(init.body)[0].max_reviews, 25);
            }),
        });
    });

    it('requires server credentials without making a request', async () => {
        for (const missing of [{ apiKey: '' }, { datasetId: '' }]) {
            await assert.rejects(
                fetchBrightDataReviews(source, {
                    ...options,
                    ...missing,
                    fetchImpl: async () => assert.fail('must not request'),
                }),
                { code: 'INGESTION_NOT_CONFIGURED' }
            );
        }
    });

    it('rejects invalid configuration before making a request', async () => {
        const invalidOptions = [
            { totalTimeoutMs: 0 },
            { totalTimeoutMs: 120001 },
            { maxReviews: 14 },
            { maxReviews: 10001 },
            { pollIntervalMs: 99 },
            { pollIntervalMs: 10001 },
            { fetchImpl: null },
        ];

        for (const invalid of invalidOptions) {
            await assert.rejects(
                fetchBrightDataReviews(source, {
                    ...options,
                    ...invalid,
                    fetchImpl:
                        'fetchImpl' in invalid 
                        ? invalid.fetchImpl  
                        : (async () => assert.fail('must not request')),
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
                fetchBrightDataReviews(source, {
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

    it('handles network failures and invalid JSON', async () => {
        await assert.rejects(
            fetchBrightDataReviews(source, {
                ...options,
                fetchImpl: async () => {
                    throw new Error('secret');
                },
            }),
            (error) => {
                assert.equal(error.code, 'PROVIDER_UNAVAILABLE');
                assert.equal(error.message.includes('secret'), false);
                return true;
            }
        );

        await assert.rejects(
            fetchBrightDataReviews(source, {
                ...options,
                fetchImpl: async () => ({
                    ok: true,
                    status: 200,
                    json: async () => {
                        throw new Error('invalid');
                    },
                }),
            }),
            { code: 'INVALID_PROVIDER_RESPONSE' }
        );
    });
});

describe('Bright Data snapshot collection', () => {
    it('polls until the snapshot is ready, then maps its results', async () => {
        const calls = [];

        const records = await fetchBrightDataReviews(source, {
            ...options,
            fetchImpl: async (url, init) => {
                const parsed = new URL(url);

                calls.push({
                    pathname: parsed.pathname,
                    init,
                });

                if (parsed.pathname.endsWith('/trigger')) {
                    return response({
                        snapshot_id: 'snapshot-123',
                    });
                }

                if (
                    parsed.pathname.endsWith(
                        '/progress/snapshot-123'
                    )
                ) {
                    return response({ status: 'ready' });
                }

                if (
                    parsed.pathname.endsWith(
                        '/snapshot/snapshot-123'
                    )
                ) {
                    assert.equal(
                        parsed.searchParams.get('format'),
                        'json'
                    );

                    return response({
                        data: [review('R1'), review('R2')],
                    });
                }

                assert.fail(`Unexpected provider URL: ${url}`);
            },
        });

        assert.deepEqual(
            calls.map((call) => call.pathname),
            [
                '/datasets/v3/trigger',
                '/datasets/v3/progress/snapshot-123',
                '/datasets/v3/snapshot/snapshot-123',
            ]
        );

        assert.equal(records.length, 2);
    });

    it('accepts the alternate snapshotId property', async () => {
        const paths = [];

        await fetchBrightDataReviews(source, {
            ...options,
            fetchImpl: async (url) => {
                const parsed = new URL(url);
                paths.push(parsed.pathname);

                if (parsed.pathname.endsWith('/trigger')) {
                    return response({
                        snapshotId: 'snapshot-alt',
                    });
                }

                if (
                    parsed.pathname.endsWith(
                        '/progress/snapshot-alt'
                    )
                ) {
                    return response({ status: 'READY' });
                }

                if (
                    parsed.pathname.endsWith(
                        '/snapshot/snapshot-alt'
                    )
                ) {
                    return response([]);
                }

                assert.fail(`Unexpected provider URL: ${url}`);
            },
        });

        assert.deepEqual(paths, [
            '/datasets/v3/trigger',
            '/datasets/v3/progress/snapshot-alt',
            '/datasets/v3/snapshot/snapshot-alt',
        ]);
    });

    it('rejects a trigger response without a snapshot identifier or direct records', async () => {
        await assert.rejects(
            fetchBrightDataReviews(source, {
                ...options,
                fetchImpl: serveDirect({
                    status: 'running',
                }),
            }),
            { code: 'INVALID_PROVIDER_RESPONSE' }
        );
    });

    it('fails when snapshot processing reports failed or error', async () => {
        for (const status of ['failed', 'error']) {
            let progressCalls = 0;

            await assert.rejects(
                fetchBrightDataReviews(source, {
                    ...options,
                    fetchImpl: async (url) => {
                        const pathname = new URL(url).pathname;

                        if (pathname.endsWith('/trigger')) {
                            return response({
                                snapshot_id: 'snapshot-fail',
                            });
                        }

                        progressCalls++;
                        return response({ status });
                    },
                }),
                { code: 'UPSTREAM_PROVIDER_ERROR' }
            );

            assert.equal(progressCalls, 1);
        }
    });

    it('times out when the snapshot never becomes ready', async () => {
        const started = Date.now();

        await assert.rejects(
            fetchBrightDataReviews(source, {
                ...options,
                totalTimeoutMs: 250,
                pollIntervalMs: 100,
                fetchImpl: async (url) => {
                    const pathname = new URL(url).pathname;

                    if (pathname.endsWith('/trigger')) {
                        return response({
                            snapshot_id: 'snapshot-slow',
                        });
                    }

                    return response({ status: 'running' });
                },
            }),
            { code: 'PROVIDER_TIMEOUT' }
        );

        assert.ok(Date.now() - started < 1000);
    });
});