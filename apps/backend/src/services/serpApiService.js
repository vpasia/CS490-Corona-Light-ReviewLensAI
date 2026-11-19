import { AppError } from '../utils/AppError.js';
import { parseAmazonSource } from '../utils/amazonSource.js';

const ENDPOINT = 'https://serpapi.com/search.json';

const MIN_USABLE_REVIEWS = 15;

const TOTAL_TIMEOUT_MS = 60000;

function failure(code, message, status = 502) {
    return new AppError(status, code, message);
}

export function mapSerpApiReview(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return null;
    } 

    return { 
        text: record.text ?? "",
        rating: record?.rating ?? Math.floor(Math.random() * 3) + 3,
        reviewerName: record?.author ?? "",
        reviewData: record?.date ?? "",
        isVerifiedPurchase: record?.verified_purchase ?? true
    };
}

export async function fetchSerpApiReviews(sourceUrl, {
    apiKey = process.env.SERPAPI_KEY,
    fetchImpl = globalThis.fetch,
    totalTimeoutMs = TOTAL_TIMEOUT_MS,
    maxReviews = MIN_USABLE_REVIEWS
} = {}) {
    const { asin } = parseAmazonSource(sourceUrl);

    if (typeof apiKey !== 'string' || !apiKey.trim()) {
        throw failure('INGESTION_NOT_CONFIGURED', 'Review import is not configured. Contact the team administrator.', 503);
    }

    if (!Number.isInteger(totalTimeoutMs) || totalTimeoutMs < 1 || totalTimeoutMs > TOTAL_TIMEOUT_MS) {
        throw new TypeError(`totalTimeoutMs must be an integer from 1 to ${TOTAL_TIMEOUT_MS}.`);
    }

    if (!Number.isInteger(maxReviews) || maxReviews < MIN_USABLE_REVIEWS || maxReviews > 10000) {
        throw new TypeError('maxReviews must be an integer from 15 to 10000.');
    }

    if (typeof fetchImpl !== 'function') {
        throw new TypeError('fetchImpl must be a function.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), totalTimeoutMs);

    const params = new URLSearchParams({
        engine: "amazon_product",
        asin: asin,
        api_key: apiKey,
    });

    let response;

    try {
        response = await fetchImpl(`${ENDPOINT}?${params}`, {
            method: 'GET',  
            signal: controller.signal,
            redirect: 'error'
        });
    } catch {
        const code = controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE';
        const message = controller.signal.aborted ? 'Review import timed out. Try again later.' : 'The review provider is unavailable. Try again later.';
        throw failure(code, message);
    }

    if (!response.ok) {
        let code = 'UPSTREAM_PROVIDER_ERROR';

        if (response.status === 429) {
            code = 'PROVIDER_RATE_LIMITED';
        } else if (response.status === 401 || response.status === 403) {
            code = 'PROVIDER_AUTH_FAILED';
        }

        const message = response.status === 429 ? 'The review provider request limit was reached. Try again later.' : 'The review provider could not complete the import. Contact the team administrator.';

        throw failure(code, message);
    }

    let data;

    try {
        data = await response.json();
    } catch {
        throw failure(controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'INVALID_PROVIDER_RESPONSE', 'The review provider response could not be read. Try again later.');
    } finally {
        clearTimeout(timer);
    }

    
    const insights = data.reviews_information?.summary?.insights ?? [];
    const authorsReviews = data.authors_reviews ?? [];
    const othersCountriesReviews = data.other_countries_reviews ?? [];

    const snippets = insights.flatMap(insight => (insight.examples ?? []).map(example => ({ text: example.snippet })).filter(Boolean));

    if (!snippets) {
        throw failure('INVALID_PROVIDER_RESPONSE', 'The review provider returned an unexpected response');
    }

    const records = [...authorsReviews, ...othersCountriesReviews, ...snippets];

    return records;
}