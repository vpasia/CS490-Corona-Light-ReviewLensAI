import { Router } from 'express';
import {
    addProduct,
    getProduct,
    getProducts,
    removeProduct,
} from '../controllers/productController.js';
import { validateProductId } from '../middleware/validateProductId.js';

const router = Router();
router.get('/', getProducts);
router.post('/', addProduct);
router.get('/:productId', validateProductId, getProduct);
router.delete('/:productId', validateProductId, removeProduct);

export default router;
