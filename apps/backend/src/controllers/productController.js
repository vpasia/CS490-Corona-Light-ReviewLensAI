import { createProduct, listProducts } from '../services/productService.js';

export async function addProduct(req, res) {
    const productId = await createProduct(req.user.uid, {
        productName: req.body?.productName,
        amazonUrl: req.body?.amazonUrl,
    });
    res.status(201).json({ data: { productId } });
}

export async function getProducts(req, res) {
    const products = await listProducts(req.user.uid);
    res.status(200).json({
        data: products,
        nextCursor: null,
        count: products.length,
    });
}
