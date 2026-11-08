import { createProduct } from '../services/productService.js';

export async function addProduct(req, res) {
    const productId = await createProduct(req.user.uid, {
        productName: req.body?.productName,
        amazonUrl: req.body?.amazonUrl,
    });
    res.status(201).json({ data: { productId } });
}
