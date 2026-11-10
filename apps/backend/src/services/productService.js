import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';
import { parseAmazonSource } from '../utils/amazonSource.js';
import { deleteQuery, productAsin } from './reviewCache.js';

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
    const { asin } = parseAmazonSource(input.amazonUrl);
    const productRef = db.collection('products').doc();
    const cacheRef = db.collection('reviewCaches').doc(asin);
    await db.runTransaction(async (tx) => {
        const cache = (await tx.get(cacheRef)).data();
        if (cache?.deleting)
            throw new AppError(
                409,
                'REVIEW_CACHE_BUSY',
                'Review cleanup is in progress. Please retry.'
            );
        // Creation and final-target deletion serialize through this document.
        tx.set(
            cacheRef,
            { asin, referencesChangedAt: FieldValue.serverTimestamp() },
            { merge: true }
        );
        tx.set(productRef, {
            productId: productRef.id,
            userId: uid,
            asin,
            productName: input.productName.trim(),
            platform: 'amazon',
            amazonUrl: input.amazonUrl.trim(),
            createdAt: FieldValue.serverTimestamp(),
        });
    });
    return productRef.id;
}

function toMillis(timestamp) {
    return typeof timestamp?.toMillis === 'function' ? timestamp.toMillis() : 0;
}

function toProductSummary(data) {
    return {
        productId: data.productId,
        productName: data.productName,
        platform: data.platform,
        amazonUrl: data.amazonUrl,
        createdAt:
            typeof data.createdAt?.toDate === 'function'
                ? data.createdAt.toDate().toISOString()
                : null,
    };
}

export async function listProducts(uid, db = getDb()) {
    if (typeof uid !== 'string' || !uid.trim()) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    const snapshot = await db
        .collection('products')
        .where('userId', '==', uid)
        .get();

    return snapshot.docs
        .map((doc) => doc.data())
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        .map(toProductSummary);
}

// Same interface as #12. Routes/controllers remain owned by that PR.
export async function deleteProduct(uid, productId, db = getDb()) {
    // getOwnedProduct intentionally hides deleting targets from normal readers;
    // deletion itself must allow retrying a partially completed cleanup.
    if (typeof uid !== 'string' || !uid.trim())
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    if (
        typeof productId !== 'string' ||
        !productId.trim() ||
        productId.includes('/')
    )
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Invalid product identifier.'
        );
    const productRef = db.collection('products').doc(productId);
    const asin = await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(productRef);
        const product = snapshot.data();
        if (!snapshot.exists || product?.userId !== uid)
            throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
        if (
            !product.deleting &&
            product.activeIngestionRunId &&
            product.ingestionLockUntil > Date.now()
        )
            throw new AppError(
                409,
                'INGESTION_IN_PROGRESS',
                'Wait for the current review import to finish before deleting this product.'
            );
        const asin = productAsin(product);
        tx.update(productRef, { deleting: true, asin });
        return asin;
    });
    await deleteQuery(
        db,
        db
            .collection('ingestionRuns')
            .where('userId', '==', uid)
            .where('productId', '==', productId)
    );
    // Synthetic or unmigrated private records may still carry the old links.
    // ASIN-backfilled legacy reviews are shared and must survive another target's deletion.
    const legacy = await db
        .collection('reviews')
        .where('userId', '==', uid)
        .where('productId', '==', productId)
        .get();
    const privateReviews = legacy.docs.filter((doc) => !doc.data().asin);
    for (let index = 0; index < privateReviews.length; index += 400) {
        const batch = db.batch();
        for (const doc of privateReviews.slice(index, index + 400))
            batch.delete(doc.ref);
        await batch.commit();
    }
    const cacheRef = db.collection('reviewCaches').doc(asin);
    const cleanupShared = await db.runTransaction(async (tx) => {
        const product = (await tx.get(productRef)).data();
        const cache = (await tx.get(cacheRef)).data();
        const targets = await tx.get(
            db.collection('products').where('asin', '==', asin).limit(2)
        );
        if (product?.userId !== uid || !product.deleting)
            throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
        if (cache?.deleting && cache.cleanupProductId !== productId)
            throw new AppError(
                409,
                'REVIEW_CACHE_BUSY',
                'Review cleanup is in progress. Please retry.'
            );
        let hasOtherTargets = targets.docs.some((doc) => doc.id !== productId);
        if (!hasOtherTargets) {
            // Temporary legacy safety: old targets may not have ASIN until migration.
            // Never remove a shared cache while an unbackfilled target still refers to it.
            const legacyTargets = await tx.get(db.collection('products'));
            hasOtherTargets = legacyTargets.docs.some((doc) => {
                const data = doc.data();
                if (doc.id === productId || data.asin) return false;
                try {
                    return productAsin(data) === asin;
                } catch {
                    return false;
                }
            });
        }
        if (hasOtherTargets) {
            tx.set(
                cacheRef,
                { referencesChangedAt: FieldValue.serverTimestamp() },
                { merge: true }
            );
            tx.delete(productRef);
            return false;
        }
        // Prevent new references/imports until bounded cleanup finishes; retryable on failure.
        tx.set(
            cacheRef,
            { asin, deleting: true, cleanupProductId: productId },
            { merge: true }
        );
        return true;
    });
    if (cleanupShared) {
        await deleteQuery(
            db,
            db.collection('reviews').where('asin', '==', asin)
        );
        await db.runTransaction(async (tx) => {
            const cache = (await tx.get(cacheRef)).data();
            const product = (await tx.get(productRef)).data();
            if (
                cache?.cleanupProductId !== productId ||
                !cache.deleting ||
                product?.userId !== uid ||
                !product.deleting
            )
                throw new AppError(
                    409,
                    'REVIEW_CACHE_BUSY',
                    'Review cleanup needs to be retried.'
                );
            tx.delete(cacheRef);
            tx.delete(productRef);
        });
    }
    return productId;
}
