import { Router } from 'express';
import {
    addProduct,
    getProduct,
    getProducts,
    getProductReviews,
    importProductReviews,
    getProductIngestionRun,
    getProductIngestionRuns,
    removeProduct,
} from '../controllers/productController.js';
import { validateProductId } from '../middleware/validateProductId.js';
import { validateProductInput } from '../middleware/validateProductInput.js';
import { validateIngestionRunId } from '../middleware/validateIngestionRunId.js';

const router = Router();
router.get('/', getProducts);
router.post('/', validateProductInput, addProduct);
router.get('/:productId', validateProductId, getProduct);
router.delete('/:productId', validateProductId, removeProduct);
router.get('/:productId/reviews', validateProductId, getProductReviews);
router.post(
    '/:productId/import-reviews',
    validateProductId,
    importProductReviews
);
router.get(
    '/:productId/ingestion-runs',
    validateProductId,
    getProductIngestionRuns
);
router.get(
    '/:productId/ingestion-runs/:ingestionRunId',
    validateProductId,
    validateIngestionRunId,
    getProductIngestionRun
);

export default router;
