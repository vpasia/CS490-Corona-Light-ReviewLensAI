import { deleteApp } from 'firebase-admin/app';
import { getDb, getFirebaseAdminApp } from '../src/config/firebaseAdmin.js';
import { planReviewMigration } from '../src/services/reviewMigration.js';

const apply = process.argv.includes('--apply');
let app;
try {
    app = getFirebaseAdminApp();
    const db = getDb();
    const [products, reviews] = await Promise.all([
        db.collection('products').get(),
        db.collection('reviews').get(),
    ]);
    const records = (snapshot) =>
        snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    const plan = planReviewMigration(records(products), records(reviews));
    console.info(
        JSON.stringify({
            mode: apply ? 'apply' : 'dry-run',
            productsToUpdate: plan.updates.filter(
                (x) => x.collection === 'products'
            ).length,
            reviewsToUpdate: plan.updates.filter(
                (x) => x.collection === 'reviews'
            ).length,
            skipped: plan.skipped.length,
            samplesExcluded: plan.skipped.filter(
                (x) => x.reason === 'SYNTHETIC_SAMPLE'
            ).length,
        })
    );
    if (apply) {
        // Run with application writes paused. Updating fields only preserves document IDs
        // and the original ownership links for audit/legacy cleanup.
        for (let i = 0; i < plan.updates.length; i += 400) {
            const batch = db.batch();
            for (const update of plan.updates.slice(i, i + 400))
                batch.update(
                    db.collection(update.collection).doc(update.id),
                    update.fields
                );
            await batch.commit();
        }
        console.info(
            'Migration completed. Legacy reviews remain unpublished; the next import creates a verified cache.'
        );
    } else
        console.info(
            'No writes made. Review counts before running --apply with application writes paused.'
        );
} catch {
    console.error(
        'Migration failed. Check private server configuration; completed batches can be safely retried.'
    );
    process.exitCode = 1;
} finally {
    if (app) await deleteApp(app);
}
