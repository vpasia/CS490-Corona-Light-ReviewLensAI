import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';

export async function getOwnedProduct(
    uid,
    productId,
    db = getFirestore(getFirebaseAdminApp())
) {
    if (typeof uid !== 'string' || !uid.trim()) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }
    const snapshot = await db.collection('products').doc(productId).get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }
    return snapshot.data();
}
