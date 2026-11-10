import assert from 'node:assert/strict';
import { describe, it } from '@jest/globals';
import {
    normalizeReview,
    normalizeReviews,
} from '../../src/services/reviewNormalizer.js';

describe('review normalization', () => {
    it('trims text and converts a plain numeric rating string', () => {
        assert.deepEqual(
            normalizeReview({
                text: '  Good sound.\n',
                rating: ' 4 ',
            }),
            {
                review: { text: 'Good sound.', rating: 4 },
                reason: null,
            }
        );
    });

    it('accepts both ends of the rating range and fractional ratings', () => {
        for (const rating of [1, 5, 4.5]) {
            const result = normalizeReview({
                text: 'Review',
                rating,
            });

            assert.equal(result.review.rating, rating);
        }
    });

    it('rejects missing, empty, and non-text review bodies', () => {
        for (const text of [undefined, null, '', ' \n ', 42, {}]) {
            assert.deepEqual(normalizeReview({ text, rating: 4 }), {
                review: null,
                reason: 'MISSING_REVIEW_TEXT',
            });
        }
    });

    it('rejects absent, misleading, non-finite, and out-of-range ratings', () => {
        const invalidRatings = [
            undefined,
            null,
            true,
            false,
            '',
            ' ',
            '5 stars',
            '0x5',
            '1e0',
            [],
            {},
            NaN,
            Infinity,
            -1,
            0,
            6,
        ];

        for (const rating of invalidRatings) {
            assert.deepEqual(normalizeReview({ text: 'Review', rating }), {
                review: null,
                reason: 'INVALID_RATING',
            });
        }
    });

    it('rejects malformed records without throwing', () => {
        for (const record of [null, undefined, [], 'review', 5]) {
            assert.deepEqual(normalizeReview(record), {
                review: null,
                reason: 'INVALID_RECORD',
            });
        }
    });

    it('preserves supported metadata without requiring it', () => {
        const record = {
            text: 'Review',
            rating: 3,
            sourceReviewId: ' R1 ',
            reviewerName: ' Reader ',
            reviewDate: '2026-01-01',
            reviewUrl: 'https://example.test/review/1',
            title: ' Fine ',
            isVerifiedPurchase: false,
        };

        assert.deepEqual(normalizeReview(record).review, {
            ...record,
            sourceReviewId: 'R1',
            reviewerName: 'Reader',
            title: 'Fine',
        });

        assert.deepEqual(
            normalizeReview({ text: 'Review', rating: 3 }).review,
            { text: 'Review', rating: 3 }
        );
    });

    it('omits invalid optional metadata and untrusted ownership fields', () => {
        const result = normalizeReview({
            text: 'Review',
            rating: 2,
            userId: 'someone-else',
            productId: 'other-product',
            reviewerName: {},
            sourceReviewId: ' ',
            isVerifiedPurchase: 'true',
            secret: 'do not copy',
        });

        assert.deepEqual(result.review, {
            text: 'Review',
            rating: 2,
        });
    });

    it('keeps valid records in order and reports invalid records by index', () => {
        const input = [
            { text: ' First ', rating: 5 },
            null,
            { text: 'Second', rating: 2 },
            { text: ' ', rating: 3 },
        ];

        // Preserve the original JSON data to check for input mutation.
        const snapshot = JSON.stringify(input);

        assert.deepEqual(normalizeReviews(input), {
            reviews: [
                { text: 'First', rating: 5 },
                { text: 'Second', rating: 2 },
            ],
            rejected: [
                { index: 1, reason: 'INVALID_RECORD' },
                { index: 3, reason: 'MISSING_REVIEW_TEXT' },
            ],
        });

        assert.equal(JSON.stringify(input), snapshot);
    });

    it('never fabricates reviews for empty or entirely invalid input', () => {
        assert.deepEqual(normalizeReviews([]), {
            reviews: [],
            rejected: [],
        });

        assert.deepEqual(normalizeReviews([null]), {
            reviews: [],
            rejected: [{ index: 0, reason: 'INVALID_RECORD' }],
        });
    });

    it('rejects malformed provider collections instead of treating them as empty success', () => {
        for (const records of [null, undefined, {}, 'reviews']) {
            assert.throws(() => normalizeReviews(records), TypeError);
        }
    });
});
