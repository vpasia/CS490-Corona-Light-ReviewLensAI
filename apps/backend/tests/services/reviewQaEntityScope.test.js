import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { buildReviewQaRequest } from '../../src/services/reviewQaPrompt.js';

const cases = JSON.parse(
    readFileSync(
        new URL('../fixtures/reviewQaEntityScope.json', import.meta.url)
    )
);
const target = { productName: 'SoundTrail H1 Headphones', platform: 'amazon' };
const evidence = JSON.stringify({
    reviews: [
        { reviewId: 'r1', rating: 4, text: 'The ear pads felt stiff.' },
        { reviewId: 'r2', rating: 3, text: 'The ear pads got uncomfortable.' },
    ],
});

describe('review Q&A entity and platform scope', () => {
    it.each(cases)('preserves active scope for $name', ({ question }) => {
        const request = buildReviewQaRequest(target, question, evidence);
        expect(request.systemInstruction.parts).toEqual([
            {
                text: expect.stringContaining(
                    'requests about another product, entity, or platform'
                ),
            },
            {
                text: 'Active target: {"productName":"SoundTrail H1 Headphones","platform":"amazon"}',
            },
        ]);
        expect(request.systemInstruction.parts[0].text).toContain(
            'Answer comparisons only when the supplied reviews contain the evidence needed for the comparison. Decline comparisons that require evidence from outside the active dataset.'
        );
        expect(request.contents).toEqual([
            {
                role: 'user',
                parts: [
                    { text: evidence },
                    { text: JSON.stringify({ question }) },
                ],
            },
        ]);
    });
});
