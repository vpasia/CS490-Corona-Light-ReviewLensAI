import { createProduct, deleteProduct } from '../services/productService.js';
import { getOwnedProduct } from '../services/ownership.js';

export async function addProduct(req, res) {
    const productId = await createProduct(req.user.uid, {
        productName: req.body?.productName,
        amazonUrl: req.body?.amazonUrl,
    });
    res.status(201).json({ data: { productId } });
}

export async function getProduct(req, res) {
    const product = await getOwnedProduct(req.user.uid, req.params.productId);
    res.status(200).json({ data: product });
}

export async function removeProduct(req, res) {
    const productId = await deleteProduct(req.user.uid, req.params.productId);
    res.status(200).json({ data: { productId } });
}
