import { AppError } from '../utils/AppError.js';

export function validateQuestion(req, _res, next) {
    const value = req.body?.question;
    const question = typeof value === 'string' ? value.trim() : '';
    let message;
    if (!question) message = 'Enter a question about the saved reviews.';
    else if (question.length > 1000) message = 'Use 1000 characters or fewer.';

    if (message) {
        return next(
            new AppError(400, 'VALIDATION_ERROR', 'Check the question.', [
                { field: 'question', message },
            ])
        );
    }
    req.body.question = question;
    next();
}
