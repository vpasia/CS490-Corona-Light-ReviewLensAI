export function createErrorPayload(code, message, details = []) {
    return { error: { code: code, message: message, details: details } };
}