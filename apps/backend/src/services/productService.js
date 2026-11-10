import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';
import { getOwnedProduct } from './ownership.js';

export async function createProduct(uid, input, db = getDb()) {
    if (typeof uid !== 'string' || !uid.trim()) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }
    for (const field of ['productName', 'amazonUrl']) {
        if (typeof input?.[field] !== 'string' || !input[field].trim()) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Required product information is missing.',
                [{ field, message: `${field} is required.` }]
            );
        }
    }
    const productRef = db.collection('products').doc();
    await productRef.set({
        productId: productRef.id,
        userId: uid,
        productName: input.productName,
        platform: 'amazon',
        amazonUrl: input.amazonUrl,
        createdAt: FieldValue.serverTimestamp(),
    });
    return productRef.id;
}

export async function deleteProduct(uid, productId, db = getDb()) {
    await getOwnedProduct(uid, productId, db);
    const productRef = db.collection('products').doc(productId);
    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(productRef);
        const product = snapshot.data();
        if (!snapshot.exists || product?.userId !== uid) {
            throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
        }
        if (
            !product.deleting &&
            product.activeIngestionRunId &&
            product.ingestionLockUntil > Date.now()
        ) {
            throw new AppError(
                409,
                'INGESTION_IN_PROGRESS',
                'Wait for the current review import to finish before deleting this product.'
            );
        }
        transaction.update(productRef, { deleting: true });
    });

    const references = [];
    for (const collectionName of ['reviews', 'ingestionRuns']) {
        const children = await db
            .collection(collectionName)
            .where('userId', '==', uid)
            .where('productId', '==', productId)
            .get();
        for (const child of children.docs) {
            references.push(child.ref);
        }
    }

    references.push(productRef);
    for (let index = 0; index < references.length; index += 400) {
        const batch = db.batch();
        for (const ref of references.slice(index, index + 400)) {
            batch.delete(ref);
        }
        await batch.commit();
    }
    return productId;
}
