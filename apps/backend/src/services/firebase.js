import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT))});

export const auth = getAuth();
export const db = getFirestore();