import { AppError } from '../utils/AppError.js';
import { normalizeReviews } from './reviewNormalizer.js';
import { deduplicateReviews } from './reviewCache.js';

const ENDPOINT = 'https://rest.canopyapi.co/api/amazon/product/reviews';
export const MIN_USABLE_REVIEWS = 15;
export const MAX_REVIEW_PAGES = 10;
export const TOTAL_TIMEOUT_MS = 120000;

function failure(code, message, status = 502) {
    return new AppError(status, code, message);
}

import { parseAmazonSource } from '../utils/amazonSource.js';
export { parseAmazonSource } from '../utils/amazonSource.js';

// Shape verified against Canopy's OpenAPI spec (GET /api/amazon/product/reviews).
export function mapCanopyReviewPage(payload) {
    if (payload?.errors?.length) {
        throw failure(
            'UPSTREAM_PROVIDER_ERROR',
            'The review provider could not complete the request.'
        );
    }
    const paginated = payload?.data?.amazonProduct?.reviewsPaginated;
    const records = paginated?.reviews;
    if (!Array.isArray(records)) {
        throw failure(
            'INVALID_PROVIDER_RESPONSE',
            'The review provider returned an unexpected response.'
        );
    }
    return {
        records: records.map((record) => {
            if (!record || typeof record !== 'object' || Array.isArray(record))
                return null;
            return {
                text: record.body,
                rating: record.rating,
                sourceReviewId: record.id,
                title: record.title,
                reviewerName: record.reviewer?.name,
                isVerifiedPurchase: record.verifiedPurchase,
            };
        }),
        // Missing or malformed page info means there is no proven next page.
        hasNextPage: paginated.pageInfo?.hasNextPage === true,
    };
}

export function mapCanopyReviews(payload) {
    return mapCanopyReviewPage(payload).records;
}

// Call only from a backend orchestration service AFTER target ownership checks.
// Returns mapped input for #21; does not persist or declare ingestion success.
export async function fetchCanopyReviews(
    sourceUrl,
    {
        apiKey = process.env.CANOPY_API_KEY,
        amazonCookie = process.env.CANOPY_AMAZON_COOKIE,
        fetchImpl = globalThis.fetch,
        timeoutMs = 60000,
        totalTimeoutMs = TOTAL_TIMEOUT_MS,
    } = {}
) {
    const { asin, domain } = parseAmazonSource(sourceUrl);
    if (
        typeof apiKey !== 'string' ||
        !apiKey.trim() ||
        typeof amazonCookie !== 'string' ||
        !amazonCookie.trim()
    ) {
        throw failure(
            'INGESTION_NOT_CONFIGURED',
            'Review import is not configured. Contact the team administrator.',
            503
        );
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
        throw new TypeError('timeoutMs must be an integer from 1 to 60000.');
    }
    if (
        !Number.isInteger(totalTimeoutMs) ||
        totalTimeoutMs < 1 ||
        totalTimeoutMs > TOTAL_TIMEOUT_MS
    ) {
        throw new TypeError(
            `totalTimeoutMs must be an integer from 1 to ${TOTAL_TIMEOUT_MS}.`
        );
    }
    const endpoint = new URL(ENDPOINT);
    endpoint.searchParams.set('asin', asin);
    endpoint.searchParams.set('domain', domain);
    // One deadline for the whole import keeps it well inside the import lock.
    const deadline = Date.now() + totalTimeoutMs;
    const collected = [];
    for (let page = 1; page <= MAX_REVIEW_PAGES; page += 1) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            throw failure(
                'PROVIDER_TIMEOUT',
                'Review import timed out. Try again later.'
            );
        }
        const { records, hasNextPage } = await requestPage(endpoint, page, {
            apiKey,
            amazonCookie,
            fetchImpl,
            timeoutMs: Math.min(timeoutMs, remaining),
        });
        collected.push(...records);
        const usable = deduplicateReviews(
            normalizeReviews(collected).reviews
        ).length;
        if (
            usable >= MIN_USABLE_REVIEWS ||
            !hasNextPage ||
            records.length === 0
        ) {
            break;
        }
    }
    return collected;
}

async function requestPage(
    endpointUrl,
    page,
    { apiKey, amazonCookie, fetchImpl, timeoutMs }
) {
    const endpoint = new URL(endpointUrl);
    endpoint.searchParams.set('page', String(page));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let response;
        try {
            response = await fetchImpl(endpoint.toString(), {
                headers: { 'API-KEY': apiKey, AMAZON_COOKIE: amazonCookie },
                signal: controller.signal,
                redirect: 'error',
            });
        } catch {
            throw failure(
                controller.signal.aborted
                    ? 'PROVIDER_TIMEOUT'
                    : 'PROVIDER_UNAVAILABLE',
                controller.signal.aborted
                    ? 'Review import timed out. Try again later.'
                    : 'The review provider is unavailable. Try again later.'
            );
        }
        if (!response.ok) {
            const code =
                response.status === 429
                    ? 'PROVIDER_RATE_LIMITED'
                    : response.status === 401 || response.status === 403
                      ? 'PROVIDER_AUTH_FAILED'
                      : 'UPSTREAM_PROVIDER_ERROR';
            throw failure(
                code,
                response.status === 429
                    ? 'The review provider request limit was reached. Try again later.'
                    : 'The review provider could not complete the import. Contact the team administrator.'
            );
        }
        let payload;
        try {
            payload = await response.json();
        } catch {
            throw failure(
                controller.signal.aborted
                    ? 'PROVIDER_TIMEOUT'
                    : 'INVALID_PROVIDER_RESPONSE',
                'The review provider response could not be read. Try again later.'
            );
        }
        return mapCanopyReviewPage(payload);
    } finally {
        clearTimeout(timer);
    }
}
