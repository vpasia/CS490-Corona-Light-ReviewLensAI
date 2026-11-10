import { Router } from 'express';
import { addProduct, getProducts } from '../controllers/productController.js';
import { validateProductInput } from '../middleware/validateProductInput.js';

const router = Router();
router.get('/', getProducts);
router.post('/', validateProductInput, addProduct);

export default router;
