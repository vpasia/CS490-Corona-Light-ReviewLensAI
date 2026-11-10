import { AppError } from '../utils/AppError.js';

import { parseAmazonSource } from '../utils/amazonSource.js';

// URL parsing can silently strip control characters, so reject them in the original input.
function hasAsciiControlCharacters(value) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code <= 0x1f || code === 0x7f) {
            return true;
        }
    }
    return false;
}

function isAmazonProductUrl(value) {
    try {
        parseAmazonSource(value);
        return true;
    } catch {
        return false;
    }
}

export function validateProductInput(req, _res, next) {
    const details = [];
    const productName = req.body?.productName;
    const amazonUrl = req.body?.amazonUrl;
    const trimmedName =
        typeof productName === 'string' ? productName.trim() : '';
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
    } else if (
        hasAsciiControlCharacters(amazonUrl) ||
        !isAmazonProductUrl(trimmedUrl)
    ) {
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
