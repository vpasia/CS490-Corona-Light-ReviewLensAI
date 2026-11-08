const ENDPOINT = 'https://rest.canopyapi.co/api/amazon/product/top-reviews';

function failure(code, message, status = 502) {
    const error = new Error(message);
    Object.assign(error, { code, status });
    return error;
}

// US Amazon product URLs only. Never fetch a user-supplied host directly.
export function parseAmazonSource(sourceUrl) {
    let url;
    try {
        url = new URL(sourceUrl);
    } catch {
        throw failure(
            'INVALID_AMAZON_URL',
            'Enter a full Amazon product URL.',
            400
        );
    }
    const match = url.pathname.match(
        /^\/(?:[^/]+\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i
    );
    if (
        url.protocol !== 'https:' ||
        !['amazon.com', 'www.amazon.com'].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.port ||
        !match
    ) {
        throw failure(
            'INVALID_AMAZON_URL',
            'Use an https://www.amazon.com/dp/ product link.',
            400
        );
    }
    return { asin: match[1].toUpperCase(), domain: 'US' };
}

// Shape verified against Canopy's official top-reviews documentation.
export function mapCanopyReviews(payload) {
    if (payload?.errors?.length) {
        throw failure(
            'UPSTREAM_PROVIDER_ERROR',
            'The review provider could not complete the request.'
        );
    }
    const records = payload?.data?.amazonProduct?.topReviews;
    if (!Array.isArray(records)) {
        throw failure(
            'INVALID_PROVIDER_RESPONSE',
            'The review provider returned an unexpected response.'
        );
    }
    return records.map((record) => {
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
    });
}

// Call only from a backend orchestration service AFTER target ownership checks.
// Returns mapped input for #21; does not persist or declare ingestion success.
export async function fetchCanopyReviews(
    sourceUrl,
    {
        apiKey = process.env.CANOPY_API_KEY,
        amazonCookie = process.env.CANOPY_AMAZON_COOKIE,
        fetchImpl = globalThis.fetch,
        timeoutMs = 15000,
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
    const endpoint = new URL(ENDPOINT);
    endpoint.searchParams.set('asin', asin);
    endpoint.searchParams.set('domain', domain);
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
        return mapCanopyReviews(payload);
    } finally {
        clearTimeout(timer);
    }
}
