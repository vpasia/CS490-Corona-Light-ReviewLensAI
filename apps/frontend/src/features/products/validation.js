const INVALID_PRODUCT_MESSAGE =
  'That doesn’t look like an Amazon product link. Paste a URL containing /dp/ or a 10-character ASIN.';
const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;
const PRODUCT_PATH_PATTERN = /\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:[/?]|$)/i;
const AMAZON_HOST_PATTERN =
  /^(?:[a-z0-9-]+\.)?amazon\.(?:com|ca|co\.uk|de|fr|it|es|nl|se|pl|co\.jp|in|com\.au|com\.mx|com\.br|sg|ae|sa)$/i;

export function validateProductInput(value) {
  const input = value.trim();

  if (!input) {
    return 'Enter an Amazon product link or ASIN.';
  }
  if (ASIN_PATTERN.test(input)) {
    return '';
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return INVALID_PRODUCT_MESSAGE;
  }

  const isWebLink = url.protocol === 'https:' || url.protocol === 'http:';
  if (!isWebLink || !AMAZON_HOST_PATTERN.test(url.hostname)) {
    return INVALID_PRODUCT_MESSAGE;
  }
  if (!PRODUCT_PATH_PATTERN.test(url.pathname)) {
    return INVALID_PRODUCT_MESSAGE;
  }
  return '';
}

export function validateProductName(value) {
  const name = value.trim();

  if (!name) {
    return 'Enter a name for this product.';
  }
  if (name.length > 200) {
    return 'Use 200 characters or fewer.';
  }
  return '';
}

export function toAmazonUrl(value) {
  const input = value.trim();

  if (ASIN_PATTERN.test(input)) {
    return `https://www.amazon.com/dp/${input.toUpperCase()}`;
  }
  return input;
}
