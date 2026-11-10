import { describe, expect, it } from 'vitest';

import { toAmazonUrl, validateProductInput, validateProductName } from './validation.js';

describe('validateProductInput', () => {
  it.each([
    ['a bare ASIN', 'B0ABCDEF12'],
    ['a lowercase ASIN', 'b0abcdef12'],
    ['a /dp/ product link', 'https://www.amazon.com/dp/B0ABCDEF12'],
    [
      'a product link with a title and tracking',
      'https://www.amazon.com/Echo-Dot/dp/B0ABCDEF12/ref=sr_1_1?keywords=echo',
    ],
    ['a /gp/product/ link', 'https://www.amazon.com/gp/product/B0ABCDEF12'],
    ['a link without www', 'https://amazon.com/dp/B0ABCDEF12'],
    ['a link with spaces around it', '  https://www.amazon.com/dp/B0ABCDEF12  '],
  ])('accepts %s', (_name, input) => {
    expect(validateProductInput(input)).toBe('');
  });

  it('asks for a link or ASIN when the field is empty', () => {
    expect(validateProductInput('   ')).toBe('Enter an Amazon product link or ASIN.');
  });

  it.each([
    ['an http link', 'http://www.amazon.com/dp/B0ABCDEF12'],
    ['a regional Amazon site', 'https://www.amazon.co.uk/dp/B0ABCDEF12'],
    ['an Amazon subdomain', 'https://smile.amazon.com/dp/B0ABCDEF12'],
    ['a link with an embedded tab', 'https://www.amazon.com/dp/B0ABC\tDEF12'],
    ['text that is not a link', 'echo dot'],
    ['an ASIN with the wrong length', 'B0ABC'],
    ['a link to another store', 'https://www.ebay.com/itm/B0ABCDEF12'],
    ['a lookalike domain', 'https://amazon.com.evil.example/dp/B0ABCDEF12'],
    ['an Amazon page that is not a product', 'https://www.amazon.com/s?k=echo+dot'],
    ['a link that is not http or https', 'ftp://www.amazon.com/dp/B0ABCDEF12'],
  ])('rejects %s with a plain-language message', (_name, input) => {
    expect(validateProductInput(input)).toMatch(/doesn’t look like an Amazon product link/);
  });
});

describe('validateProductName', () => {
  it('accepts a normal product name', () => {
    expect(validateProductName('Echo Dot (5th Gen)')).toBe('');
  });

  it('asks for a name when the field is empty', () => {
    expect(validateProductName('   ')).toBe('Enter a name for this product.');
  });

  it('rejects a name longer than 200 characters', () => {
    expect(validateProductName('a'.repeat(201))).toBe('Use 200 characters or fewer.');
  });
});

describe('toAmazonUrl', () => {
  it('turns a bare ASIN into an Amazon product link', () => {
    expect(toAmazonUrl(' b0abcdef12 ')).toBe('https://www.amazon.com/dp/B0ABCDEF12');
  });

  it('leaves a product link unchanged apart from trimming', () => {
    expect(toAmazonUrl(' https://www.amazon.com/dp/B0ABCDEF12 ')).toBe(
      'https://www.amazon.com/dp/B0ABCDEF12',
    );
  });
});
