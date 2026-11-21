import { AppError } from '../utils/AppError.js';
import { buildReviewContext } from './reviewContextService.js';
import { getOwnedProduct } from './ownership.js';
import { countGeminiTokens } from './geminiTokenCounter.js';
import {
    ANALYSIS_OUTPUT_TOKEN_LIMIT,
    ANALYSIS_INSTRUCTION,
    analyzeReviewBatch,
} from './geminiReviewAnalyzer.js';

const MAX_INPUT_TOKENS = 16384;
const MAX_EVIDENCE_TOKENS = 8192;
const SCHEMA_RESERVE_TOKENS = ANALYSIS_OUTPUT_TOKEN_LIMIT;

function invalidAnalysis() {
    return new AppError(
        502,
        'UPSTREAM_PROVIDER_ERROR',
        'Question analysis is temporarily unavailable. Try again later.'
    );
}

function recordKey(record) {
    return `${record.reviewId}\u0000${record.partIndex ?? 0}`;
}

function canonicalTheme(value) {
    return value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

function themeAppearsInExcerpt(theme, excerpt) {
    const themeWords = canonicalTheme(theme).split(' ');
    const excerptWords = canonicalTheme(excerpt).split(' ');
    return (
        themeWords.length > 0 &&
        excerptWords.some((_, start) =>
            themeWords.every(
                (word, offset) => excerptWords[start + offset] === word
            )
        )
    );
}

function hasControlCharacter(value) {
    return [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
    });
}

function checkBatch(records, output, knownThemes) {
    if (
        !Array.isArray(output?.reviews) ||
        output.reviews.length !== records.length
    )
        throw invalidAnalysis();
    const expected = new Map(
        records.map((record) => [recordKey(record), record])
    );
    const seen = new Set();
    const findings = [];
    for (const entry of output.reviews) {
        if (
            typeof entry?.reviewId !== 'string' ||
            !Number.isSafeInteger(entry.partIndex) ||
            !Array.isArray(entry.themes)
        )
            throw invalidAnalysis();
        const key = recordKey(entry);
        const record = expected.get(key);
        if (!record || seen.has(key)) throw invalidAnalysis();
        seen.add(key);
        for (const item of entry.themes) {
            if (
                typeof item?.theme !== 'string' ||
                !['complaint', 'other'].includes(item.kind) ||
                !['direct', 'related'].includes(item.evidenceRelation) ||
                !['supports', 'opposes', 'mixed', 'not_applicable'].includes(
                    item.stance
                ) ||
                (item.evidenceRelation === 'related' &&
                    item.stance !== 'not_applicable') ||
                !item.theme.trim() ||
                item.theme.length > 100 ||
                hasControlCharacter(item.theme) ||
                typeof item.excerpt !== 'string' ||
                !item.excerpt.trim() ||
                item.excerpt.length > 300 ||
                hasControlCharacter(item.excerpt) ||
                !record.text.includes(item.excerpt)
            )
                throw invalidAnalysis();
            findings.push({
                reviewId: record.reviewId,
                theme: item.theme.trim(),
                kind: item.kind,
                evidenceRelation: item.evidenceRelation,
                stance: item.stance,
                excerpt: item.excerpt,
            });
        }
    }
    if (seen.size !== expected.size) throw invalidAnalysis();
    const supportedThemes = new Set(knownThemes.keys());
    for (const finding of findings) {
        if (themeAppearsInExcerpt(finding.theme, finding.excerpt))
            supportedThemes.add(
                `${canonicalTheme(finding.theme)}\u0000${finding.kind}`
            );
    }
    if (
        findings.some(
            (finding) =>
                !supportedThemes.has(
                    `${canonicalTheme(finding.theme)}\u0000${finding.kind}`
                )
        )
    )
        throw invalidAnalysis();
    return findings;
}

function renderAnswer(question, groups, total) {
    const noun = total === 1 ? 'review' : 'reviews';
    const asksAboutComplaints =
        /\b(complaints?|issues?|problems?|drawbacks?|defects?|failures?|trouble|concerns?|downsides?)\b/i.test(
            question
        );
    if (!groups.length) {
        const caveat = asksAboutComplaints
            ? ' No complaint meets the frequent threshold.'
            : '';
        return `No matching themes were found in ${total} saved ${noun}.${caveat}`;
    }
    const lines = [`Analyzed ${total} saved ${noun}.`];
    let frequentFound = false;
    let complaintFound = false;
    for (const group of groups) {
        const count = group.reviewIds.size;
        if (group.kind === 'complaint') complaintFound = true;
        const frequent =
            group.kind === 'complaint' && count >= 4 && count / total >= 0.2;
        if (frequent) frequentFound = true;
        const label = frequent ? 'Frequent complaint: ' : '';
        const examples = group.excerpts
            .slice(0, 2)
            .map((excerpt) => `“${excerpt}”`)
            .join('; ');
        lines.push(
            `${label}${group.theme}: ${count} of ${total} saved ${noun}. For example: ${examples}.`
        );
    }
    if ((asksAboutComplaints || complaintFound) && !frequentFound)
        lines.push(
            'No complaint meets the frequent threshold of four reviews and 20% of this saved dataset.'
        );
    return lines.join('\n');
}

export async function answerQuestion(
    uid,
    productId,
    question,
    {
        db,
        countTokens = countGeminiTokens,
        analyzeBatch = analyzeReviewBatch,
        tokenLimit,
    } = {}
) {
    await getOwnedProduct(uid, productId, db);
    const overhead = await countTokens(
        JSON.stringify({
            instruction: ANALYSIS_INSTRUCTION,
            question,
        })
    );
    if (!Number.isSafeInteger(overhead) || overhead < 0)
        throw invalidAnalysis();
    const allowance =
        tokenLimit ??
        Math.min(
            MAX_EVIDENCE_TOKENS,
            MAX_INPUT_TOKENS - SCHEMA_RESERVE_TOKENS - overhead
        );
    if (!Number.isSafeInteger(allowance) || allowance < 1) {
        throw new AppError(
            413,
            'QUESTION_TOO_LARGE',
            'Question is too large to analyze.'
        );
    }

    const context = await buildReviewContext(uid, productId, {
        db,
        tokenLimit: allowance,
        countTokens,
    });
    const sourceIds = new Set(
        context.sourceReviews.map((review) => review.reviewId)
    );
    if (sourceIds.size !== context.sourceReviewCount || !context.batches.length)
        throw invalidAnalysis();

    const groups = new Map();
    const knownThemes = new Map();
    for (const batch of context.batches) {
        const records = JSON.parse(batch.text).reviews;
        const analysisContext = {
            question,
            existingThemes: [...knownThemes.values()],
            evidence: records,
        };
        const inputTokens = await countTokens(
            JSON.stringify({
                instruction: ANALYSIS_INSTRUCTION,
                ...analysisContext,
            })
        );
        if (!Number.isSafeInteger(inputTokens) || inputTokens < 0)
            throw invalidAnalysis();
        if (inputTokens + SCHEMA_RESERVE_TOKENS > MAX_INPUT_TOKENS) {
            throw new AppError(
                413,
                'REVIEW_CONTEXT_TOO_LARGE',
                'Saved reviews could not be prepared for analysis.'
            );
        }
        const output = await analyzeBatch(question, batch.text, {
            existingThemes: analysisContext.existingThemes,
        });
        for (const finding of checkBatch(records, output, knownThemes)) {
            if (!sourceIds.has(finding.reviewId)) throw invalidAnalysis();
            const canonical = canonicalTheme(finding.theme);
            if (!canonical) throw invalidAnalysis();
            const key = `${canonical}\u0000${finding.kind}`;
            if (!knownThemes.has(key))
                knownThemes.set(key, finding.theme.trim());
            if (!groups.has(key))
                groups.set(key, {
                    theme: finding.theme,
                    kind: finding.kind,
                    reviewIds: new Set(),
                    excerpts: [],
                });
            const group = groups.get(key);
            if (!group.reviewIds.has(finding.reviewId)) {
                group.reviewIds.add(finding.reviewId);
                if (group.excerpts.length < 2)
                    group.excerpts.push(finding.excerpt);
            }
        }
    }
    return renderAnswer(
        question,
        [...groups.values()].sort(
            (left, right) => right.reviewIds.size - left.reviewIds.size
        ),
        context.sourceReviewCount
    );
}
