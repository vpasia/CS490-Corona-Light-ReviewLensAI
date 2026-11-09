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

    const references = [];
    for (const collectionName of ['reviews', 'analyses']) {
        const children = await db
            .collection(collectionName)
            .where('userId', '==', uid)
            .where('productId', '==', productId)
            .get();
        for (const child of children.docs) {
            references.push(child.ref);
        }
    }

    references.push(db.collection('products').doc(productId));
    for (let index = 0; index < references.length; index += 400) {
        const batch = db.batch();
        for (const ref of references.slice(index, index + 400)) {
            batch.delete(ref);
        }
        await batch.commit();
    }
    return productId;
}
