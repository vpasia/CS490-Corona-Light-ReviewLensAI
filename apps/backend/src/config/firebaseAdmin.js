import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';

const localEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));

if (existsSync(localEnvPath)) {
    process.loadEnvFile(localEnvPath);
}

export function getFirebaseAdminApp() {
    if (getApps().length > 0) {
        return getApp();
    }

    if (!process.env.SERVICE_ACCOUNT) {
        throw new Error('Missing Firebase Admin configuration.');
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
    } catch {
        throw new Error('Invalid Firebase Admin configuration.');
    }

    return initializeApp({
        credential: cert(serviceAccount),
    });
}
