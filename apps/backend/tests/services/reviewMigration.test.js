import { describe, it, expect } from '@jest/globals';
import { planReviewMigration } from '../../src/services/reviewMigration.js';
const products = [
    { id: 'A', amazonUrl: 'https://www.amazon.com/dp/B07PRVS98X' },
];
describe('legacy migration planning', () => {
    it('backfills ASIN and preserves real records without inventing a fresh scrape date', () => {
        const plan = planReviewMigration(products, [
            { id: 'R', productId: 'A', text: 'Good sound', rating: 4 },
        ]);
        expect(plan.updates).toEqual([
            { collection: 'products', id: 'A', fields: { asin: 'B07PRVS98X' } },
            {
                collection: 'reviews',
                id: 'R',
                fields: {
                    asin: 'B07PRVS98X',
                    cacheVersion: 'legacy-unpublished',
                    fetchedAtMs: 0,
                    expiresAtMs: 0,
                },
            },
        ]);
    });
    it('does not promote synthetic samples, invalid records, or unresolved products', () => {
        const plan = planReviewMigration(products, [
            {
                id: 'S',
                productId: 'A',
                sourceReviewId: 'test-review-002',
                text: 'Sample',
                rating: 4,
            },
            { id: 'U', productId: 'missing', text: 'Good', rating: 4 },
            { id: 'I', productId: 'A', text: '', rating: 9 },
        ]);
        expect(plan.updates).toHaveLength(1);
        expect(plan.skipped).toHaveLength(3);
    });
    it('is idempotent for already migrated records and refuses mismatched ASINs', () => {
        expect(
            planReviewMigration(
                [{ ...products[0], asin: 'B07PRVS98X' }],
                [
                    {
                        id: 'R',
                        asin: 'B07PRVS98X',
                        cacheVersion: 'legacy-unpublished',
                    },
                ]
            ).updates
        ).toEqual([]);
        expect(
            planReviewMigration([{ ...products[0], asin: 'WRONG' }], [])
                .skipped[0].reason
        ).toBe('ASIN_MISMATCH');
    });
    it('skips a legacy review whose ownership link does not match its product', () => {
        const plan = planReviewMigration(
            [{ ...products[0], userId: 'a' }],
            [
                {
                    id: 'R',
                    productId: 'A',
                    userId: 'b',
                    text: 'Good sound',
                    rating: 4,
                },
            ]
        );
        expect(plan.updates).toHaveLength(1);
        expect(plan.skipped).toHaveLength(1);
    });
});
