import { Router } from 'express';
import { addProduct } from '../controllers/productController.js';

const router = Router();
router.post('/', addProduct);

export default router;
