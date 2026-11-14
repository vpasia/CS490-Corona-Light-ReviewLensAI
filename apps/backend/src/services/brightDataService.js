import { AppError } from '../utils/AppError.js';
import { parseAmazonSource } from '../utils/amazonSource.js';

const ENDPOINT = 'https://api.brightdata.com/datasets/v3';

const BRIGHTDATA_DATASET_ID = 'gd_le8e811kzy4ggddlq';
const MIN_USABLE_REVIEWS = 15;

const POLL_INTERVAL_MS = 2000;
const TOTAL_TIMEOUT_MS = 120000;

function failure(code, message, status = 502) {
    return new AppError(status, code, message);
}

export function mapBrightDataReview(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return null;
    } 

    return {
        text: record.review_text ?? record.review_body ?? record.body,
        rating: record.rating,
        sourceReviewId: record.review_id ?? record.id,
        title: record.review_title ?? record.title,
        reviewerName: record.author_name ?? record.reviewer_name,
        isVerifiedPurchase: record.verified_purchase ?? record.verifiedPurchase
    };
}

export function mapBrightDataReviews(payload) {
    let records = null;
    
    if (Array.isArray(payload)) {
        records = payload;
    } else if (Array.isArray(payload?.data)) {
        records = payload.data;
    } else if (Array.isArray(payload?.results)) {
        records = payload.results;
    }

    if (!records) {
        throw failure('INVALID_PROVIDER_RESPONSE', 'The review provider returned an unexpected response');
    }

    return records.map(mapBrightDataReview).filter(Boolean);
}

async function fetchJson(url, { method = 'GET', apiKey, body, fetchImpl, timeoutMs }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;

    try {
        response = await fetchImpl(url, {
            method,  
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...(body ? { 'Content-Type' : 'application/json' } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
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

    try {
        return await response.json();
    } catch {
        throw failure(controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'INVALID_PROVIDER_RESPONSE', 'The review provider response could not be read. Try again later.');
    } finally {
        clearTimeout(timer);
    }
}

async function triggerCollection(sourceUrl, { apiKey, datasetId, maxReviews, fetchImpl, timeoutMs }) {
    const endpoint = new URL(`${ENDPOINT}/trigger`);

    endpoint.searchParams.set('dataset_id', datasetId);
    endpoint.searchParams.set('format', 'json');

    const payload = [
        {
            url: sourceUrl,
            reviews_to_not_include: [],
            max_reviews: maxReviews,
        }
    ];

    return fetchJson(endpoint.toString(), {
        method: 'POST',
        apiKey,
        body: payload,
        fetchImpl,
        timeoutMs
    });
}

async function getSnapshotProgress(snapshotId, { apiKey, fetchImpl, timeoutMs }) {
    const endpoint = `${ENDPOINT}/progress/${encodeURIComponent(snapshotId)}`;

    return fetchJson(endpoint, { apiKey, fetchImpl, timeoutMs });
}

async function getSnapshot(snapshotId, { apiKey, fetchImpl, timeoutMs }) {
    const endpoint = new URL(`${ENDPOINT}/snapshot/${encodeURIComponent(snapshotId)}`);

    endpoint.searchParams.set('format', 'json');

    return fetchJson(endpoint.toString(), { apiKey, fetchImpl, timeoutMs });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSnapshot(snapshotId, { apiKey, fetchImpl, deadline, pollIntervalMs }) {
    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();

        if (remaining <= 0) {
            break;
        }

        const progress = await getSnapshotProgress( snapshotId, { apiKey, fetchImpl, timeoutMs: Math.min(30000, remaining) });

        const status = progress?.status?.toLowerCase();

        if (status === 'ready') {
            return getSnapshot(snapshotId, { apiKey, fetchImpl, timeoutMs: Math.min(30000, Math.max(1, deadline - Date.now()))});
        }

        if (status === 'failed' ||status === 'error') {
            throw failure('UPSTREAM_PROVIDER_ERROR', 'The review provider could not complete the import.');
        }

        await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    }

    throw failure('PROVIDER_TIMEOUT', 'Review import timed out. Try again later.');
}

export async function fetchBrightDataReviews(sourceUrl, {
    apiKey = process.env.BRIGHT_DATA_API_KEY,
    datasetId = BRIGHTDATA_DATASET_ID,
    fetchImpl = globalThis.fetch,
    totalTimeoutMs = TOTAL_TIMEOUT_MS,
    pollIntervalMs = POLL_INTERVAL_MS,
    maxReviews = MIN_USABLE_REVIEWS
} = {}) {
    parseAmazonSource(sourceUrl);

    if (typeof apiKey !== 'string' || !apiKey.trim()) {
        throw failure('INGESTION_NOT_CONFIGURED', 'Review import is not configured. Contact the team administrator.', 503);
    }

    if (typeof datasetId !== 'string' || !datasetId.trim()) {
        throw failure('INGESTION_NOT_CONFIGURED', 'Review import is not configured. Contact the team administrator.', 503);
    }

    if (!Number.isInteger(totalTimeoutMs) || totalTimeoutMs < 1 || totalTimeoutMs > TOTAL_TIMEOUT_MS) {
        throw new TypeError(`totalTimeoutMs must be an integer from 1 to ${TOTAL_TIMEOUT_MS}.`);
    }

    if (!Number.isInteger(maxReviews) || maxReviews < MIN_USABLE_REVIEWS || maxReviews > 10000) {
        throw new TypeError('maxReviews must be an integer from 15 to 10000.');
    }

    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 100 || pollIntervalMs > 10000) {
        throw new TypeError('pollIntervalMs must be an integer from 100 to 10000.');
    }

    if (typeof fetchImpl !== 'function') {
        throw new TypeError('fetchImpl must be a function.');
    }

    const deadline = Date.now() + totalTimeoutMs;
    const remaining = deadline - Date.now();

    const triggerResponse = await triggerCollection(sourceUrl, {
        apiKey,
        datasetId,
        maxReviews,
        fetchImpl,
        timeoutMs: Math.min(30000, remaining),
    });

    let payload;

    if (Array.isArray(triggerResponse) || Array.isArray(triggerResponse?.data) || Array.isArray(triggerResponse?.results)) {
        payload = triggerResponse;
    }  else {
        const snapshotId = triggerResponse?.snapshot_id ?? triggerResponse?.snapshotId;

        if (typeof snapshotId !== 'string' || !snapshotId.trim()) {
            throw failure('INVALID_PROVIDER_RESPONSE', 'The review provider returned an unexpected response.');
        }

        payload = await waitForSnapshot(snapshotId, {
            apiKey,
            fetchImpl,
            deadline,
            pollIntervalMs,
        });
    }

    const records = mapBrightDataReviews(payload);

    return records;
}