import { Router } from 'express';
import { addProduct } from '../controllers/productController.js';
import { validateProductInput } from '../middleware/validateProductInput.js';

const router = Router();
router.post('/', validateProductInput, addProduct);

export default router;
