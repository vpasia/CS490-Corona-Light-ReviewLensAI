const OPTIONAL_TEXT_FIELDS = [
    'sourceReviewId',
    'reviewerName',
    'reviewDate',
    'reviewUrl',
    'title',
];

// Input is provider-independent: the Canopy adapter must map its verified
// response fields into this shape before calling this function.
export function normalizeReview(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return { review: null, reason: 'INVALID_RECORD' };
    }

    if (typeof record.text !== 'string' || !record.text.trim()) {
        return { review: null, reason: 'MISSING_REVIEW_TEXT' };
    }

    // Only numeric values or plain decimal strings are accepted. In particular,
    // Number(null), Number(true), and parseFloat('5 stars') must not invent ratings.
    const rawRating = record.rating;
    const rating =
        typeof rawRating === 'number'
            ? rawRating
            : typeof rawRating === 'string' &&
                /^\d+(?:\.\d+)?$/.test(rawRating.trim())
              ? Number(rawRating.trim())
              : NaN;

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return { review: null, reason: 'INVALID_RATING' };
    }

    const review = { text: record.text.trim(), rating };
    for (const field of OPTIONAL_TEXT_FIELDS) {
        if (typeof record[field] === 'string' && record[field].trim()) {
            review[field] = record[field].trim();
        }
    }

    // Explicitly retain supported metadata; never spread source data, ownership
    // fields, provider errors, or arbitrary properties into a persisted review.
    if (typeof record.isVerifiedPurchase === 'boolean') {
        review.isVerifiedPurchase = record.isVerifiedPurchase;
    }

    return { review, reason: null };
}

export function normalizeReviews(records) {
    if (!Array.isArray(records)) {
        throw new TypeError('Review input must be an array.');
    }

    const reviews = [];
    const rejected = [];
    records.forEach((record, index) => {
        const result = normalizeReview(record);
        if (result.review) {
            reviews.push(result.review);
        } else {
            rejected.push({ index, reason: result.reason });
        }
    });

    // This is a normalization result, not a successful ingestion declaration.
    // Persistence and final run status belong to the ingestion service.
    return { reviews, rejected };
}
