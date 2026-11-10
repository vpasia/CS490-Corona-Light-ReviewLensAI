import assert from 'node:assert/strict';
import { describe, it } from '@jest/globals';
import {
    fetchCanopyReviews,
    mapCanopyReviews,
    parseAmazonSource,
} from '../../src/services/canopyService.js';

const source = 'https://www.amazon.com/dp/B012345678';
// Synthetic fixture using the documented shape; NOT a live provider recording.
const fixture = {
    data: {
        amazonProduct: {
            topReviews: [
                {
                    id: 'R1',
                    body: ' Good sound ',
                    rating: 5,
                    title: 'Nice',
                    reviewer: { name: 'Reader' },
                    verifiedPurchase: true,
                },
            ],
        },
    },
};
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
        assert.deepEqual(
            mapCanopyReviews({
                data: { amazonProduct: { topReviews: [null] } },
            }),
            [null]
        );
    });
    it('rejects missing collections and provider errors', () => {
        for (const payload of [
            {},
            null,
            { errors: [{ message: 'secret provider detail' }] },
        ]) {
            assert.throws(() => mapCanopyReviews(payload));
        }
    });
    it('returns an empty list without fabricating records', () => {
        assert.deepEqual(
            mapCanopyReviews({ data: { amazonProduct: { topReviews: [] } } }),
            []
        );
    });
    it('makes exactly one request to Canopy and keeps credentials out of URL', async () => {
        let calls = 0;
        const records = await fetchCanopyReviews(source, {
            ...options,
            fetchImpl: async (url, init) => {
                calls++;
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
