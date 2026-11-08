import { getAuth } from '../config/firebaseAdmin.js';
import { createErrorPayload } from '../utils/utils.js';

export async function verifyUserToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json(createErrorPayload("UNAUTHORIZED", "Missing Token."));
    }

    const token = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await getAuth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        res.status(401).json(createErrorPayload("UNAUTHORIZED", "Invalid or expired token."));
    }
}