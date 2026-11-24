import { AppError } from '../utils/AppError.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const COUNT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:countTokens`;

export async function countGeminiTokens(
    text,
    {
        apiKey = process.env.GEMINI_API_KEY,
        fetchImpl = globalThis.fetch,
        timeoutMs = 10000,
    } = {}
) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
        throw new AppError(
            503,
            'GEMINI_NOT_CONFIGURED',
            'Question analysis is not configured. Contact the team administrator.'
        );
    }

    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Token count timed out.'));
        }, timeoutMs);
    });

    try {
        const response = await Promise.race([
            fetchImpl(COUNT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text }] }],
                }),
                signal: controller.signal,
                redirect: 'error',
            }),
            timeout,
        ]);
        if (!response.ok) throw new Error('Gemini token count failed.');
        const payload = await Promise.race([response.json(), timeout]);
        if (
            !Number.isSafeInteger(payload?.totalTokens) ||
            payload.totalTokens < 0
        )
            throw new Error('Invalid Gemini token count.');
        return payload.totalTokens;
    } catch {
        throw new AppError(
            502,
            'UPSTREAM_PROVIDER_ERROR',
            'Question analysis is temporarily unavailable. Try again later.'
        );
    } finally {
        clearTimeout(timer);
    }
}
