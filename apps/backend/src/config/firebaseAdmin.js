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

    const { SERVICE_PROJECT_ID, SERVICE_CLIENT_EMAIL, SERVICE_PRIVATE_KEY } =
        process.env;

    if (!SERVICE_PROJECT_ID || !SERVICE_CLIENT_EMAIL || !SERVICE_PRIVATE_KEY) {
        throw new Error('Missing Firebase Admin configuration.');
    }

    return initializeApp({
        credential: cert({
            projectId: SERVICE_PROJECT_ID,
            clientEmail: SERVICE_CLIENT_EMAIL,
            privateKey: SERVICE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}
