const INVALID_PRODUCT_MESSAGE =
  'That doesn’t look like an Amazon product link. Paste a URL containing /dp/ or a 10-character ASIN.';
const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;
const PRODUCT_PATH_PATTERN = /\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:[/?]|$)/i;
const AMAZON_HOSTS = new Set(['amazon.com', 'www.amazon.com']);

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

export function validateProductInput(value) {
  if (hasAsciiControlCharacters(value)) {
    return INVALID_PRODUCT_MESSAGE;
  }
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

  if (
    url.protocol !== 'https:' ||
    !AMAZON_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  ) {
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
