import { AppError } from '../utils/AppError.js';
import { getReviewDataset } from './reviewService.js';
import { countGeminiTokens } from './geminiTokenCounter.js';

function serialize(records) {
    return JSON.stringify({ reviews: records });
}

function sizeError() {
    return new AppError(
        503,
        'REVIEW_CONTEXT_TOO_LARGE',
        'Saved reviews could not be prepared for analysis.'
    );
}

function batch(records, tokenCount, index) {
    return Object.freeze({
        index,
        text: serialize(records),
        tokenCount,
        reviewIds: Object.freeze([
            ...new Set(records.map((record) => record.reviewId)),
        ]),
    });
}

async function measuredCount(records, countTokens) {
    const count = await countTokens(serialize(records));
    if (!Number.isSafeInteger(count) || count < 0) throw sizeError();
    return count;
}

async function longestFit(makeRecords, length, tokenLimit, countTokens) {
    let low = 1;
    let high = length;
    let best = null;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const records = makeRecords(middle);
        const tokenCount = await measuredCount(records, countTokens);
        if (tokenCount <= tokenLimit) {
            best = { length: middle, records, tokenCount };
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return best;
}

export async function buildReviewContext(
    uid,
    productId,
    { db, tokenLimit, countTokens = countGeminiTokens } = {}
) {
    const dataset = await getReviewDataset(uid, productId, db);
    if (dataset.status === 'notImported') {
        throw new AppError(
            409,
            'REVIEWS_NOT_IMPORTED',
            'Reviews need importing.'
        );
    }
    if (dataset.status === 'expired') {
        throw new AppError(409, 'REVIEWS_EXPIRED', 'Reviews need reimporting.');
    }
    if (!Number.isSafeInteger(tokenLimit) || tokenLimit < 1) {
        throw new TypeError('tokenLimit must be a positive integer.');
    }

    const reviews = dataset.reviews.map((review) => {
        if (
            typeof review.reviewId !== 'string' ||
            typeof review.text !== 'string' ||
            !review.text.trim() ||
            !Number.isFinite(review.rating) ||
            review.rating < 1 ||
            review.rating > 5
        ) {
            throw new AppError(
                503,
                'REVIEW_CACHE_INCOMPLETE',
                'Review data needs to be refreshed.'
            );
        }
        return {
            reviewId: review.reviewId,
            rating: review.rating,
            text: review.text,
        };
    });
    reviews.sort((left, right) =>
        left.reviewId < right.reviewId
            ? -1
            : left.reviewId > right.reviewId
              ? 1
              : 0
    );
    const sourceReviews = Object.freeze(
        reviews.map((review) => Object.freeze(review))
    );

    const fullCount = await measuredCount(reviews, countTokens);
    if (fullCount <= tokenLimit) {
        return Object.freeze({
            productId,
            sourceReviewCount: reviews.length,
            sourceReviews,
            batches: Object.freeze([batch(reviews, fullCount, 1)]),
        });
    }

    const batches = [];
    let cursor = 0;
    while (cursor < reviews.length) {
        const fit = await longestFit(
            (length) => reviews.slice(cursor, cursor + length),
            reviews.length - cursor,
            tokenLimit,
            countTokens
        );
        if (fit) {
            batches.push(
                batch(fit.records, fit.tokenCount, batches.length + 1)
            );
            cursor += fit.length;
            continue;
        }

        const review = reviews[cursor];
        const characters = Array.from(review.text);
        let offset = 0;
        let partIndex = 1;
        while (offset < characters.length) {
            const part = await longestFit(
                (length) => [
                    {
                        reviewId: review.reviewId,
                        rating: review.rating,
                        partIndex,
                        text: characters
                            .slice(offset, offset + length)
                            .join(''),
                    },
                ],
                characters.length - offset,
                tokenLimit,
                countTokens
            );
            if (!part) throw sizeError();
            batches.push(
                batch(part.records, part.tokenCount, batches.length + 1)
            );
            offset += part.length;
            partIndex += 1;
        }
        cursor += 1;
    }

    return Object.freeze({
        productId,
        sourceReviewCount: reviews.length,
        sourceReviews,
        batches: Object.freeze(batches),
    });
}
