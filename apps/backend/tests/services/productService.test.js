import { jest, describe, it, expect } from '@jest/globals';
import { memoryDb } from '../helpers/memoryDb.js';
jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: () => {
        throw new Error('Unexpected live access');
    },
}));
jest.unstable_mockModule('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'SERVER_TIME',
        delete: () => 'DELETE_FIELD',
    },
}));
const { createProduct, listProducts, deleteProduct } =
    await import('../../src/services/productService.js');
const { getOwnedProduct } = await import('../../src/services/ownership.js');
const asin = 'B07PRVS98X',
    url = `https://www.amazon.com/dp/${asin}`;
const product = (userId) => ({
    userId,
    asin,
    amazonUrl: url,
    productName: 'Headphones',
    platform: 'amazon',
});
const setup = () =>
    memoryDb({
        products: { A: product('a'), B: product('b') },
        reviews: {
            R: {
                asin,
                cacheVersion: 'v',
                text: 'Real public review',
                rating: 5,
            },
        },
        ingestionRuns: {
            RA: { userId: 'a', productId: 'A' },
            RB: { userId: 'b', productId: 'B' },
        },
        reviewCaches: { [asin]: { version: 'v', asin } },
    });
describe('product ASIN references and deletion', () => {
    it('derives ASIN on the server and ignores client ownership/ASIN fields', async () => {
        const db = memoryDb();
        const id = await createProduct(
            'a',
            {
                productName: ' Headphones ',
                amazonUrl: url.toLowerCase(),
                asin: 'FORGED',
                userId: 'forged',
            },
            db
        );
        expect(db.data('products', id)).toMatchObject({
            userId: 'a',
            productName: 'Headphones',
        });
    });
    it('rejects unsupported input before making a product', async () => {
        const db = memoryDb();
        await expect(
            createProduct(
                'a',
                {
                    productName: 'Headphones',
                    amazonUrl: 'http://amazon.com/dp/B07PRVS98X',
                },
                db
            )
        ).rejects.toMatchObject({ code: 'INVALID_AMAZON_URL' });
        expect(db.docs('products')).toHaveLength(0);
        await expect(
            createProduct('', { productName: 'X', amazonUrl: url }, db)
        ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
        await expect(
            createProduct('a', { amazonUrl: url }, db)
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
    it('lists only owned products without changing the existing summary contract', async () => {
        const db = setup();
        const products = await listProducts('a', db);
        expect(products).toHaveLength(1);
        expect(products[0]).toMatchObject({ productName: 'Headphones' });
    });
    it('preserves shared reviews and the other owners history when deleting one target', async () => {
        const db = setup();
        await deleteProduct('a', 'A', db);
        expect(db.data('products', 'A')).toBeUndefined();
        expect(db.data('products', 'B')).toBeDefined();
        expect(db.docs('reviews')).toHaveLength(1);
        expect(db.data('ingestionRuns', 'RA')).toBeUndefined();
        expect(db.data('ingestionRuns', 'RB')).toBeDefined();
    });
    it('removes shared reviews and cache only after deleting the last reference', async () => {
        const db = setup();
        await deleteProduct('a', 'A', db);
        await deleteProduct('b', 'B', db);
        expect(db.docs('products')).toHaveLength(0);
        expect(db.docs('reviews')).toHaveLength(0);
        expect(db.docs('reviewCaches')).toHaveLength(0);
    });
    it('rejects foreign and missing products without deleting anything', async () => {
        const db = setup();
        for (const id of ['B', 'missing'])
            await expect(deleteProduct('a', id, db)).rejects.toMatchObject({
                code: 'PRODUCT_NOT_FOUND',
            });
        expect(db.docs('products')).toHaveLength(2);
        expect(db.docs('reviews')).toHaveLength(1);
    });
    it('blocks deletion during an active import', async () => {
        const db = setup();
        await db
            .collection('products')
            .doc('A')
            .update({
                activeIngestionRunId: 'r',
                ingestionLockUntil: Date.now() + 60000,
            });
        await expect(deleteProduct('a', 'A', db)).rejects.toMatchObject({
            code: 'INGESTION_IN_PROGRESS',
        });
        expect(db.data('products', 'A').deleting).toBeUndefined();
    });
    it('allows cleanup retry after a bounded batch fails', async () => {
        const db = setup();
        db.controls.failBatch = true;
        await expect(deleteProduct('a', 'A', db)).rejects.toThrow();
        expect(db.data('products', 'A').deleting).toBe(true);
        await expect(getOwnedProduct('a', 'A', db)).rejects.toMatchObject({
            code: 'PRODUCT_NOT_FOUND',
        });
        db.controls.failBatch = false;
        await deleteProduct('a', 'A', db);
        expect(db.data('products', 'A')).toBeUndefined();
    });
    it('blocks new references while last-target review cleanup is pending', async () => {
        const db = memoryDb({
            reviewCaches: { [asin]: { deleting: true, cleanupProductId: 'A' } },
        });
        await expect(
            createProduct(
                'b',
                { productName: 'Headphones', amazonUrl: url },
                db
            )
        ).rejects.toMatchObject({ code: 'REVIEW_CACHE_BUSY' });
        expect(db.docs('products')).toHaveLength(0);
    });
    it('handles simultaneous deletion of two references without orphaning reviews', async () => {
        const db = setup();
        await Promise.all([
            deleteProduct('a', 'A', db),
            deleteProduct('b', 'B', db),
        ]);
        expect(db.docs('products')).toHaveLength(0);
        expect(db.docs('reviews')).toHaveLength(0);
    });
    it('preserves shared reviews for old targets not yet backfilled with ASIN', async () => {
        const db = setup();
        await db
            .collection('products')
            .doc('B')
            .set({ userId: 'b', amazonUrl: url });
        await deleteProduct('a', 'A', db);
        expect(db.docs('reviews')).toHaveLength(1);
    });
    it('retains backfilled ASIN reviews even if their legacy ownership fields remain', async () => {
        const db = setup();
        await db
            .collection('reviews')
            .doc('R')
            .update({ userId: 'a', productId: 'A' });
        await deleteProduct('a', 'A', db);
        expect(db.docs('reviews')).toHaveLength(1);
    });
    it('cleans multiple review generations across bounded batches for the last target', async () => {
        const reviews = Object.fromEntries(
            Array.from({ length: 850 }, (_, i) => [
                `R${i}`,
                { asin, cacheVersion: `v${i % 3}`, rating: 4, text: 'Review' },
            ])
        );
        const db = memoryDb({
            products: { A: product('a') },
            reviews,
            reviewCaches: { [asin]: { asin, version: 'v1' } },
        });
        await deleteProduct('a', 'A', db);
        expect(db.docs('reviews')).toHaveLength(0);
        expect(db.docs('products')).toHaveLength(0);
    });
});
