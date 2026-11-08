import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';

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
