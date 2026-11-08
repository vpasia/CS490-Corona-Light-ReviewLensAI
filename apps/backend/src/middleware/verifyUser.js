import { getFirebaseAuth } from '../config/firebaseAdmin.js';
import { AppError } from '../utils/AppError.js';

export async function verifyUserToken(req, _res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError(401, 'UNAUTHENTICATED', 'Missing Token.'));
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getFirebaseAuth();

    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(token);
    } catch {
        return next(
            new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token.')
        );
    }

    if (typeof decodedToken?.uid !== 'string' || !decodedToken.uid.trim()) {
        return next(
            new AppError(401, 'UNAUTHENTICATED', 'Authentication required.')
        );
    }

    req.user = decodedToken;
    next();
}
