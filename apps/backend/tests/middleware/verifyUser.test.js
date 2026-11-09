import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getFirebaseAuth: jest.fn(),
}));

const { getFirebaseAuth } = await import('../../src/config/firebaseAdmin.js');

const { verifyUserToken } = await import('../../src/middleware/verifyUser.js');
const { errorHandler } = await import('../../src/middleware/errorHandler.js');

describe('verifyUserToken middleware', () => {
    let app;
    let mockVerifyIdToken;
    let forwardedError;

    beforeEach(() => {
        jest.clearAllMocks();
        forwardedError = undefined;

        mockVerifyIdToken = jest.fn();

        getFirebaseAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

        app = express();

        app.get('/protected', verifyUserToken, (req, res) => {
            res.status(200).json({ user: req.user });
        });
        app.use((error, _req, _res, next) => {
            forwardedError = error;
            next(error);
        });
        app.use(errorHandler);
    });

    it('should return 401 when authorization header is missing', async () => {
        const response = await request(app).get('/protected');

        expect(response.status).toBe(401);

        expect(response.body).toEqual({
            error: {
                code: 'UNAUTHENTICATED',
                message: 'Missing Token.',
                details: [],
            },
        });

        expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is not Bearer', async () => {
        const response = await request(app)
            .get('/protected')
            .set('Authorization', 'Basic some-token');

        expect(response.status).toBe(401);

        expect(response.body).toEqual({
            error: {
                code: 'UNAUTHENTICATED',
                message: 'Missing Token.',
                details: [],
            },
        });

        expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('should return 401 when Firebase token is invalid', async () => {
        mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

        const response = await request(app)
            .get('/protected')
            .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);

        expect(response.body).toEqual({
            error: {
                code: 'UNAUTHENTICATED',
                message: 'Invalid or expired token.',
                details: [],
            },
        });

        expect(mockVerifyIdToken).toHaveBeenCalledWith('invalid-token');
    });

    it('should return 200 and attach decoded token to req.user when valid', async () => {
        const decodedToken = {
            uid: 'user-123',
            email: 'test@example.com',
            email_verified: true,
        };

        mockVerifyIdToken.mockResolvedValue(decodedToken);

        const response = await request(app)
            .get('/protected')
            .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ user: decodedToken });
        expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
    });

    it.each([
        ['missing token', undefined, undefined, 'Missing Token.'],
        [
            'invalid token',
            'Bearer invalid-token',
            'reject',
            'Invalid or expired token.',
        ],
        [
            'missing uid',
            'Bearer token-without-uid',
            'no-uid',
            'Authentication required.',
        ],
    ])(
        'forwards %s to the central error handler',
        async (_case, header, tokenResult, message) => {
            if (tokenResult === 'reject')
                mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
            if (tokenResult === 'no-uid')
                mockVerifyIdToken.mockResolvedValue({ uid: ' ' });

            const call = request(app).get('/protected');
            if (header) call.set('Authorization', header);
            const response = await call;

            expect(forwardedError).toMatchObject({
                status: 401,
                code: 'UNAUTHENTICATED',
                message,
            });
            expect(response.status).toBe(401);
            expect(response.body).toEqual({
                error: { code: 'UNAUTHENTICATED', message, details: [] },
            });
        }
    );

    it('forwards Firebase Admin setup failures as a generic 500', async () => {
        getFirebaseAuth.mockImplementation(() => {
            throw new Error('Private Firebase setup detail');
        });

        const response = await request(app)
            .get('/protected')
            .set('Authorization', 'Bearer token');

        expect(forwardedError?.message).toBe('Private Firebase setup detail');
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred.',
                details: [],
            },
        });
    });
});
