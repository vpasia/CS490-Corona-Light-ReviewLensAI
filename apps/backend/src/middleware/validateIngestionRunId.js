import { AppError } from '../utils/AppError.js';

export function validateIngestionRunId(req, _res, next) {
    const ingestionRunId = req.params.ingestionRunId;
    if (!ingestionRunId || ingestionRunId.includes('/')) {
        return next(
            new AppError(
                400,
                'VALIDATION_ERROR',
                'Invalid ingestion identifier.',
                [
                    {
                        field: 'ingestionRunId',
                        message: 'Ingestion run ID cannot contain a slash.',
                    },
                ]
            )
        );
    }
    next();
}
