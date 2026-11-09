import { AppError } from '../utils/AppError.js';

const AMAZON_HOST_PATTERN =
    /^(?:[a-z0-9-]+\.)?amazon\.(?:com|ca|co\.uk|de|fr|it|es|nl|se|pl|co\.jp|in|com\.au|com\.mx|com\.br|sg|ae|sa)$/i;
const PRODUCT_PATH_PATTERN = /\/(?:dp|gp\/product)\/[a-z0-9]{10}(?:[/?]|$)/i;

function isAmazonProductUrl(value) {
    if (value.includes('\n') || value.includes('\r') || value.includes('\t')) {
        return false;
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    return (
        (url.protocol === 'https:' || url.protocol === 'http:') &&
        AMAZON_HOST_PATTERN.test(url.hostname) &&
        PRODUCT_PATH_PATTERN.test(url.pathname)
    );
}

export function validateProductInput(req, _res, next) {
    const details = [];
    const productName = req.body?.productName;
    const amazonUrl = req.body?.amazonUrl;
    const trimmedName = typeof productName === 'string' ? productName.trim() : '';
    const trimmedUrl = typeof amazonUrl === 'string' ? amazonUrl.trim() : '';

    if (!trimmedName) {
        details.push({
            field: 'productName',
            message: 'Enter a name for this product.',
        });
    } else if (trimmedName.length > 200) {
        details.push({
            field: 'productName',
            message: 'Use 200 characters or fewer.',
        });
    }

    if (!trimmedUrl) {
        details.push({
            field: 'amazonUrl',
            message: 'Enter an Amazon product link.',
        });
    } else if (!isAmazonProductUrl(trimmedUrl)) {
        details.push({
            field: 'amazonUrl',
            message:
                'Enter an Amazon product link containing /dp/ or /gp/product/ and a 10-character ASIN.',
        });
    }

    if (details.length) {
        return next(
            new AppError(
                400,
                'VALIDATION_ERROR',
                'Check the product details.',
                details
            )
        );
    }

    req.body.productName = trimmedName;
    req.body.amazonUrl = trimmedUrl;
    next();
}
