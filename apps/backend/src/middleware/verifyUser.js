import { getFirebaseAuth } from '../config/firebaseAdmin.js';
import { createErrorPayload } from '../utils/utils.js';

export async function verifyUserToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res
            .status(401)
            .json(createErrorPayload('UNAUTHENTICATED', 'Missing Token.'));
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getFirebaseAuth();

    try {
        const decodedToken = await auth.verifyIdToken(token);
        if (typeof decodedToken?.uid !== 'string' || !decodedToken.uid.trim()) {
            return res
                .status(401)
                .json(
                    createErrorPayload(
                        'UNAUTHENTICATED',
                        'Authentication required.'
                    )
                );
        }
        req.user = decodedToken;
        next();
    } catch {
        return res
            .status(401)
            .json(
                createErrorPayload(
                    'UNAUTHENTICATED',
                    'Invalid or expired token.'
                )
            );
    }
}