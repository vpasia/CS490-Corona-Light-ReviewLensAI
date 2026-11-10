import { AppError } from '../utils/AppError.js';

export function validateProductId(req, _res, next) {
    if (req.params.productId.includes('/')) {
        return next(
            new AppError(400, 'VALIDATION_ERROR', 'Invalid product ID.', [
                {
                    field: 'productId',
                    message: 'Product ID cannot contain a slash.',
                },
            ])
        );
    }
    next();
}
