import {
    createProduct,
    deleteProduct,
    listProducts,
} from '../services/productService.js';
import { getOwnedProduct } from '../services/ownership.js';
import { getReviews } from '../services/reviewService.js';
import { importReviews } from '../services/ingestionService.js';
import {
    getIngestionRun,
    getIngestionRuns,
} from '../services/ingestionService.js';

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

export async function getProducts(req, res) {
    const products = await listProducts(req.user.uid);
    res.status(200).json({
        data: products,
        nextCursor: null,
        count: products.length,
    });
}

export async function getProductReviews(req, res) {
    const reviews = await getReviews(req.user.uid, req.params.productId);
    res.status(200).json({ data: reviews });
}

export async function importProductReviews(req, res) {
    const result = await importReviews(req.user.uid, req.params.productId);
    res.status(200).json({ data: result });
}

export async function getProductIngestionRuns(req, res) {
    const runs = await getIngestionRuns(req.user.uid, req.params.productId);
    res.status(200).json({ data: runs, count: runs.length });
}

export async function getProductIngestionRun(req, res) {
    const run = await getIngestionRun(
        req.user.uid,
        req.params.productId,
        req.params.ingestionRunId
    );
    res.status(200).json({ data: run });
}
