import { describe, expect, it, jest } from '@jest/globals';
import { buildReviewQaRequest } from '../../src/services/reviewQaPrompt.js';
import { memoryDb } from '../helpers/memoryDb.js';

jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: () => {
        throw new Error('Unexpected live access');
    },
}));

const { getOwnedProduct } = await import('../../src/services/ownership.js');
const { getReviewDataset } =
    await import('../../src/services/reviewService.js');
const { REVIEW_TTL_MS } = await import('../../src/services/reviewCache.js');

const firstAsin = 'B07PRVS98X';
const secondAsin = 'B012345678';
const firstReview = {
    reviewId: 'review-a',
    rating: 2,
    text: 'The copper hinge rattled after one train ride.',
};
const secondReview = {
    reviewId: 'review-b',
    rating: 5,
    text: 'The blue ear pads stayed comfortable all morning.',
};
const question = 'What did the reviews for Target A say about its hinges?';

function setup() {
    const now = Date.now();
    const cache = {
        version: 'active',
        fetchedAtMs: now,
        expiresAtMs: now + REVIEW_TTL_MS,
        reviewCount: 1,
    };
    return memoryDb({
        products: {
            'target-a': {
                userId: 'user-a',
                productName: 'Target A',
                platform: 'amazon',
                amazonUrl: `https://www.amazon.com/dp/${firstAsin}`,
            },
            'target-b': {
                userId: 'user-b',
                productName: 'Target B',
                platform: 'amazon',
                amazonUrl: `https://www.amazon.com/dp/${secondAsin}`,
            },
        },
        reviewCaches: { [firstAsin]: cache, [secondAsin]: cache },
        reviews: {
            [firstReview.reviewId]: {
                asin: firstAsin,
                cacheVersion: cache.version,
                rating: firstReview.rating,
                text: firstReview.text,
            },
            [secondReview.reviewId]: {
                asin: secondAsin,
                cacheVersion: cache.version,
                rating: secondReview.rating,
                text: secondReview.text,
            },
        },
    });
}

// Compose the available service boundaries until the shared /analyze route lands.
async function sendOwnedReviewContext(db, uid, productId, generate) {
    const dataset = await getReviewDataset(uid, productId, db);
    const target = await getOwnedProduct(uid, productId, db);
    const reviews = dataset.reviews.map(({ reviewId, rating, text }) => ({
        reviewId,
        rating,
        text,
    }));
    await generate(
        buildReviewQaRequest(target, question, JSON.stringify({ reviews }))
    );
}

describe('ownership-checked review Q&A context', () => {
    it('denies a foreign target before loading its cache or calling the model', async () => {
        const db = setup();
        const collection = jest.spyOn(db, 'collection');
        const generate = jest.fn();

        await expect(
            sendOwnedReviewContext(db, 'user-b', 'target-a', generate)
        ).rejects.toMatchObject({
            status: 404,
            code: 'PRODUCT_NOT_FOUND',
        });
        expect(collection.mock.calls).toEqual([['products']]);
        expect(generate).not.toHaveBeenCalled();
    });

    it.each([
        ['user-a', 'target-a', 'Target A', firstReview, secondReview],
        ['user-b', 'target-b', 'Target B', secondReview, firstReview],
    ])(
        'only passes selected target evidence to the model for %s',
        async (uid, productId, productName, selectedReview, otherReview) => {
            const generate = jest.fn();
            await sendOwnedReviewContext(setup(), uid, productId, generate);

            expect(generate).toHaveBeenCalledTimes(1);
            const [[payload]] = generate.mock.calls;
            expect(payload.systemInstruction.parts[1].text).toBe(
                `Active target: ${JSON.stringify({ productName, platform: 'amazon' })}`
            );
            const [evidence, prompt] = payload.contents[0].parts;
            expect(JSON.parse(evidence.text)).toEqual({
                reviews: [selectedReview],
            });
            expect(JSON.parse(prompt.text)).toEqual({ question });
            expect(JSON.stringify(payload)).not.toContain(otherReview.text);
        }
    );
});
