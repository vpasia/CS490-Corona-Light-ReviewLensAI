import { describe, it, expect } from '@jest/globals';
import { parseAmazonSource } from '../../src/utils/amazonSource.js';
describe('shared source URL contract', () => {
    it.each([
        'https://amazon.com/dp/b07prvs98x',
        'https://www.amazon.com/Headphones/dp/B07PRVS98X?th=1',
        'https://www.amazon.com/gp/product/B07PRVS98X/',
        'https://www.amazon.com/a/b/dp/B07PRVS98X',
    ])('extracts the canonical US ASIN from %s', (url) => {
        expect(parseAmazonSource(url)).toEqual({
            asin: 'B07PRVS98X',
            domain: 'US',
        });
    });
    it.each([
        'http://amazon.com/dp/B07PRVS98X',
        'https://amazon.co.uk/dp/B07PRVS98X',
        'https://amazon.com.evil.test/dp/B07PRVS98X',
        'https://evil@amazon.com/dp/B07PRVS98X',
        'https://amazon.com:8080/dp/B07PRVS98X',
        'https://amazon.com/dp/B07PRVS98XX',
        'https://amazon.com/search?q=/dp/B07PRVS98X',
        'https://amazon.com/dp/B07\nPRVS98X',
        'B07PRVS98X',
    ])('rejects unsupported input %s', (url) => {
        expect(() => parseAmazonSource(url)).toThrow(
            expect.objectContaining({ code: 'INVALID_AMAZON_URL' })
        );
    });
});
