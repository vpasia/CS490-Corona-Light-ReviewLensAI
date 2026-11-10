import { AppError } from './AppError.js';

// One URL contract for creation, validation and Canopy retrieval.
export function parseAmazonSource(sourceUrl) {
    let url;
    if (
        typeof sourceUrl === 'string' &&
        ![...sourceUrl].some(
            (character) =>
                character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127
        )
    ) {
        try {
            url = new URL(sourceUrl.trim());
        } catch {
            /* Invalid URL below. */
        }
    }
    const match = url?.pathname.match(
        /\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i
    );
    if (
        !url ||
        url.protocol !== 'https:' ||
        !['amazon.com', 'www.amazon.com'].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.port ||
        !match
    ) {
        throw new AppError(
            400,
            'INVALID_AMAZON_URL',
            'Provide an HTTPS amazon.com product URL containing a 10-character ASIN.'
        );
    }
    return { asin: match[1].toUpperCase(), domain: 'US' };
}
