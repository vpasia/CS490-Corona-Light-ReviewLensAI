import { describe, expect, it, jest } from '@jest/globals';
import { buildReviewQaRequest } from '../../src/services/reviewQaPrompt.js';

const target = { productName: 'Trail Mug', platform: 'amazon' };
const reviews = [
    {
        reviewId: 'r1',
        rating: 5,
        text: 'The lid stayed sealed in my backpack.',
    },
    { reviewId: 'r2', rating: 2, text: 'The handle felt too small.' },
];
const reviewEvidence = JSON.stringify({ reviews });

const refusal = {
    outOfScope: true,
    answer: 'I can help with the supplied Amazon reviews for Trail Mug. What would you like to know about them?',
};

const cases = [
    ['What is the weather today?', refusal],
    ['Will I need an umbrella this afternoon?', refusal],
    ['Who is the President of the United States?', refusal],
    ['Who currently holds the office of U.S. president?', refusal],
    ['Write a Python sorting algorithm.', refusal],
    ['Show me how to order a list of numbers in Python.', refusal],
    ['What are the best restaurants in New York?', refusal],
    ['Where should I book dinner in NYC?', refusal],
    [
        'What do reviewers say about the lid staying sealed?',
        {
            outOfScope: false,
            answer: 'One reviewer said the lid stayed sealed in their backpack.',
        },
    ],
];

describe('review Q&A scope evaluation requests (mocked model)', () => {
    // The fixture responses specify the desired behavior for a future live evaluation.
    // This suite verifies request construction without simulating scope detection.
    it.each(cases)(
        'sends scope and evidence to the model for "%s"',
        async (question, expectedResponse) => {
            const generate = jest.fn().mockResolvedValue(expectedResponse);
            await generate(
                buildReviewQaRequest(target, question, reviewEvidence)
            );

            expect(generate).toHaveBeenCalledTimes(1);
            expect(generate).toHaveBeenCalledWith({
                systemInstruction: {
                    parts: [
                        {
                            text: expect.stringContaining(
                                'Politely decline unrelated requests'
                            ),
                        },
                        {
                            text: 'Active target: {"productName":"Trail Mug","platform":"amazon"}',
                        },
                    ],
                },
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: reviewEvidence },
                            { text: JSON.stringify({ question }) },
                        ],
                    },
                ],
            });
            const instruction =
                generate.mock.calls[0][0].systemInstruction.parts[0].text;
            expect(instruction).toContain('using only the supplied reviews');
            expect(instruction).toContain('invite a question about them');
        }
    );
});
