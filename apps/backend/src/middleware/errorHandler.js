import { AppError } from '../utils/AppError.js';

export function errorHandler(error, _req, res, next) {
    if (res.headersSent) return next(error);

    if (error.status === 400 && error.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Malformed JSON body.',
                details: [],
            },
        });
    }

    if (error.status === 413 && error.type === 'entity.too.large') {
        return res.status(413).json({
            error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Request body is too large.',
                details: [],
            },
        });
    }

    if (error instanceof AppError) {
        return res.status(error.status).json({
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        });
    }

    res.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred.',
            details: [],
        },
    });
}
