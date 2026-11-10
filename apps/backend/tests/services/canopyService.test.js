import assert from 'node:assert/strict';
import { describe, it } from '@jest/globals';
import {
    fetchCanopyReviews,
    mapCanopyReviewPage,
    mapCanopyReviews,
    parseAmazonSource,
} from '../../src/services/canopyService.js';

const source = 'https://www.amazon.com/dp/B012345678';
const review = (id, extra = {}) => ({
    id,
    body: `Review ${id}`,
    rating: 4,
    ...extra,
});
const page = (reviews, hasNextPage) => ({
    data: {
        amazonProduct: {
            reviewsPaginated: { reviews, pageInfo: { hasNextPage } },
        },
    },
});
// Synthetic fixture using the documented shape; NOT a live provider recording.
const fixture = page(
    [
        {
            id: 'R1',
            body: ' Good sound ',
            rating: 5,
            title: 'Nice',
            reviewer: { name: 'Reader' },
            verifiedPurchase: true,
        },
    ],
    false
);
const options = { apiKey: 'test-key', amazonCookie: 'test-cookie' };

describe('Canopy review service', () => {
    it('extracts a product identifier from a source URL', () => {
        assert.deepEqual(parseAmazonSource(source), {
            asin: 'B012345678',
            domain: 'US',
        });
        assert.equal(
            parseAmazonSource(
                'https://amazon.com/item-name/dp/B012345678?tag=x'
            ).asin,
            'B012345678'
        );
    });
    it('rejects unsupported URLs before making a provider call', async () => {
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
                fetchCanopyReviews(url, {
                    ...options,
                    fetchImpl: async () => {
                        called = true;
                    },
                }),
                { code: 'INVALID_AMAZON_URL' }
            );
            assert.equal(called, false);
        }
    });
    it('maps documented fields for normalization', () => {
        assert.deepEqual(mapCanopyReviews(fixture), [
            {
                text: ' Good sound ',
                rating: 5,
                sourceReviewId: 'R1',
                title: 'Nice',
                reviewerName: 'Reader',
                isVerifiedPurchase: true,
            },
        ]);
    });
    it('keeps malformed individual records for #21 rejection', () => {
        assert.deepEqual(mapCanopyReviews(page([null], false)), [null]);
    });
    it('mapCanopyReviewPage returns records and hasNextPage', () => {
        const result = mapCanopyReviewPage(page([review('A')], true));
        assert.equal(result.hasNextPage, true);
        assert.equal(result.records.length, 1);
    });
    it('treats missing pageInfo as the last page', () => {
        for (const payload of [
            {
                data: {
                    amazonProduct: {
                        reviewsPaginated: { reviews: [review('A')] },
                    },
                },
            },
            {
                data: {
                    amazonProduct: {
                        reviewsPaginated: {
                            reviews: [review('A')],
                            pageInfo: { hasNextPage: 'yes' },
                        },
                    },
                },
            },
        ]) {
            const result = mapCanopyReviewPage(payload);
            assert.equal(result.hasNextPage, false);
            assert.equal(result.records.length, 1);
        }
    });
    it('rejects missing collections and provider errors', () => {
        for (const payload of [
            {},
            null,
            { errors: [{ message: 'secret provider detail' }] },
            { data: { amazonProduct: { reviewsPaginated: { reviews: {} } } } },
            { data: { amazonProduct: { topReviews: [review('A')] } } },
        ]) {
            assert.throws(() => mapCanopyReviews(payload));
        }
    });
    it('returns an empty list without fabricating records', () => {
        assert.deepEqual(mapCanopyReviews(page([], false)), []);
    });
    it('requests the paginated endpoint without filters and keeps credentials out of URL', async () => {
        let calls = 0;
        const records = await fetchCanopyReviews(source, {
            ...options,
            fetchImpl: async (url, init) => {
                calls++;
                const u = new URL(url);
                assert.equal(u.pathname, '/api/amazon/product/reviews');
                assert.equal(u.searchParams.get('page'), '1');
                assert.equal(u.searchParams.get('domain'), 'US');
                for (const p of ['rating', 'onlyVerifiedReviews', 'search'])
                    assert.equal(u.searchParams.has(p), false);
                assert.equal(new URL(url).origin, 'https://rest.canopyapi.co');
                assert.equal(
                    new URL(url).searchParams.get('asin'),
                    'B012345678'
                );
                assert.equal(url.includes(options.apiKey), false);
                assert.equal(init.headers['API-KEY'], options.apiKey);
                assert.equal(init.headers.AMAZON_COOKIE, options.amazonCookie);
                assert.equal(init.redirect, 'error');
                return { ok: true, json: async () => fixture };
            },
        });
        assert.equal(calls, 1);
        assert.equal(records[0].text, ' Good sound ');
    });
    it('requires server credentials without making a request', async () => {
        for (const missing of [{ apiKey: '' }, { amazonCookie: '' }]) {
            await assert.rejects(
                fetchCanopyReviews(source, {
                    ...options,
                    ...missing,
                    fetchImpl: async () => {
                        assert.fail('must not request');
                    },
                }),
                { code: 'INGESTION_NOT_CONFIGURED' }
            );
        }
    });
    it('handles HTTP errors without exposing response text or retrying', async () => {
        for (const [status, code] of [
            [429, 'PROVIDER_RATE_LIMITED'],
            [401, 'PROVIDER_AUTH_FAILED'],
            [403, 'PROVIDER_AUTH_FAILED'],
            [500, 'UPSTREAM_PROVIDER_ERROR'],
        ]) {
            await assert.rejects(
                fetchCanopyReviews(source, {
                    ...options,
                    fetchImpl: async () => ({ ok: false, status }),
                }),
                { code }
            );
        }
    });
    it('handles network failures and invalid JSON', async () => {
        await assert.rejects(
            fetchCanopyReviews(source, {
                ...options,
                fetchImpl: async () => {
                    throw new Error('secret');
                },
            }),
            { code: 'PROVIDER_UNAVAILABLE' }
        );
        await assert.rejects(
            fetchCanopyReviews(source, {
                ...options,
                fetchImpl: async () => ({
                    ok: true,
                    json: async () => {
                        throw new Error('invalid');
                    },
                }),
            }),
            { code: 'INVALID_PROVIDER_RESPONSE' }
        );
    });
    it('aborts timed-out requests', async () => {
        await assert.rejects(
            fetchCanopyReviews(source, {
                ...options,
                timeoutMs: 5,
                fetchImpl: async (_url, { signal }) =>
                    new Promise((_resolve, reject) => {
                        signal.addEventListener(
                            'abort',
                            () => reject(new Error('abort')),
                            { once: true }
                        );
                    }),
            }),
            { code: 'PROVIDER_TIMEOUT' }
        );
    });
});

const serve = (pages) => {
    const seen = [];
    const fetchImpl = async (url) => {
        const n = Number(new URL(url).searchParams.get('page'));
        seen.push(n);
        const body = pages[n - 1];
        if (body instanceof Error) throw body;
        if (typeof body === 'number') return { ok: false, status: body };
        if (typeof body === 'function') return { ok: true, json: body };
        return { ok: true, json: async () => body };
    };
    return { fetchImpl, seen };
};
const ids = (prefix, n) =>
    Array.from({ length: n }, (_, i) => review(`${prefix}${i}`));

describe('Canopy review pagination', () => {
    it('stops once at least 15 usable reviews are collected', async () => {
        const { fetchImpl, seen } = serve([
            page(ids('a', 10), true),
            page(ids('b', 10), true),
            page(ids('c', 10), true),
        ]);
        const records = await fetchCanopyReviews(source, {
            ...options,
            fetchImpl,
        });
        assert.deepEqual(seen, [1, 2]);
        assert.equal(records.length, 20);
    });
    it('does not count invalid or duplicate records toward 15', async () => {
        const { fetchImpl, seen } = serve([
            page(
                [
                    ...ids('a', 10),
                    null,
                    review('bad', { rating: 9 }),
                    review('nobody', { body: '' }),
                ],
                true
            ),
            page(ids('a', 10), true),
            page(ids('c', 5), true),
            page(ids('d', 10), true),
        ]);
        await fetchCanopyReviews(source, { ...options, fetchImpl });
        assert.deepEqual(seen, [1, 2, 3]);
    });
    it('returns what exists when the product runs out of reviews', async () => {
        const { fetchImpl, seen } = serve([
            page(ids('a', 10), true),
            page(ids('b', 2), false),
        ]);
        const records = await fetchCanopyReviews(source, {
            ...options,
            fetchImpl,
        });
        assert.deepEqual(seen, [1, 2]);
        assert.equal(records.length, 12);
    });
    it('stops on a page with zero records', async () => {
        const { fetchImpl, seen } = serve([
            page(ids('a', 5), true),
            page([], true),
            page(ids('c', 10), true),
        ]);
        const records = await fetchCanopyReviews(source, {
            ...options,
            fetchImpl,
        });
        assert.deepEqual(seen, [1, 2]);
        assert.equal(records.length, 5);
    });
    it('stops at the 10-page cap', async () => {
        const { fetchImpl, seen } = serve(
            Array.from({ length: 12 }, () => page([review('same')], true))
        );
        const records = await fetchCanopyReviews(source, {
            ...options,
            fetchImpl,
        });
        assert.equal(seen.length, 10);
        assert.equal(records.length, 10);
    });
    it('fails the whole call when a later page fails', async () => {
        for (const [second, code] of [
            [new Error('secret'), 'PROVIDER_UNAVAILABLE'],
            [429, 'PROVIDER_RATE_LIMITED'],
            [401, 'PROVIDER_AUTH_FAILED'],
            [500, 'UPSTREAM_PROVIDER_ERROR'],
            [{ errors: [{ message: 'secret' }] }, 'UPSTREAM_PROVIDER_ERROR'],
            [
                async () => {
                    throw new Error('secret');
                },
                'INVALID_PROVIDER_RESPONSE',
            ],
        ]) {
            const { fetchImpl, seen } = serve([
                page(ids('a', 10), true),
                second,
            ]);
            await assert.rejects(
                fetchCanopyReviews(source, { ...options, fetchImpl }),
                (error) => {
                    assert.equal(error.code, code);
                    assert.equal(error.message.includes('secret'), false);
                    return true;
                }
            );
            assert.deepEqual(seen, [1, 2]);
        }
    });
    it('enforces one overall deadline across pages', async () => {
        const started = Date.now();
        await assert.rejects(
            fetchCanopyReviews(source, {
                ...options,
                timeoutMs: 60000,
                totalTimeoutMs: 50,
                fetchImpl: async (url, { signal }) => {
                    if (new URL(url).searchParams.get('page') === '1') {
                        await new Promise((resolve) => setTimeout(resolve, 30));
                        return {
                            ok: true,
                            json: async () => page(ids('a', 5), true),
                        };
                    }
                    return new Promise((_resolve, reject) => {
                        signal.addEventListener(
                            'abort',
                            () => reject(new Error('abort')),
                            { once: true }
                        );
                    });
                },
            }),
            { code: 'PROVIDER_TIMEOUT' }
        );
        assert.ok(Date.now() - started < 1000);
    });
    it('rejects an invalid totalTimeoutMs', async () => {
        for (const totalTimeoutMs of [0, 120001]) {
            await assert.rejects(
                fetchCanopyReviews(source, {
                    ...options,
                    totalTimeoutMs,
                    fetchImpl: async () => assert.fail('must not request'),
                }),
                TypeError
            );
        }
    });
});
