import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';

export function requireOwner(snapshot, uid) {
    const product = snapshot.data();
    if (
        !snapshot.exists ||
        product?.userId !== uid ||
        product.deleting === true
    )
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    return product;
}

export async function getOwnedProduct(uid, productId, db = getDb()) {
    if (typeof uid !== 'string' || !uid.trim())
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    return requireOwner(
        await db.collection('products').doc(productId).get(),
        uid
    );
}
