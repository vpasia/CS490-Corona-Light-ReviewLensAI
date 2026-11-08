import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";

jest.unstable_mockModule("../../src/config/firebaseAdmin.js", () => ({
    getFirebaseAuth: jest.fn()
}));

const { getFirebaseAuth } = await import("../../src/config/firebaseAdmin.js");

const { verifyUserToken } = await import("../../src/middleware/verifyUser.js");

describe("verifyUserToken middleware", () => {
    let app;
    let mockVerifyIdToken;

    beforeEach(() => {
        jest.clearAllMocks();

        mockVerifyIdToken = jest.fn();

        getFirebaseAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

        app = express();

        app.get("/protected", verifyUserToken, (req, res) => {
            res.status(200).json({ user: req.user });
        });
    });

    it("should return 401 when authorization header is missing", async () => {
        const response = await request(app).get("/protected");

        expect(response.status).toBe(401);

        expect(response.body).toEqual({
            error: {
                code: "UNAUTHORIZED",
                message: "Missing Token.",
                details: "",
            },
        });

        expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization header is not Bearer", async () => {
        const response = await request(app).get("/protected").set("Authorization", "Basic some-token");

        expect(response.status).toBe(401);

        expect(response.body).toEqual({
            error: {
                code: "UNAUTHORIZED",
                message: "Missing Token.",
                details: ""
            }
        });

        expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it("should return 401 when Firebase token is invalid", async () => {
        mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

        const response = await request(app).get("/protected").set("Authorization", "Bearer invalid-token");

        expect(response.status).toBe(401);

        expect(response.body).toEqual({
            error: {
                code: "UNAUTHORIZED",
                message: "Invalid or expired token.",
                details: ""
            }
        });

        expect(mockVerifyIdToken).toHaveBeenCalledWith("invalid-token");
    });

    it("should return 200 and attach decoded token to req.user when valid", async () => {
        const decodedToken = {
            uid: "user-123",
            email: "test@example.com",
            email_verified: true
        };

        mockVerifyIdToken.mockResolvedValue(decodedToken);

        const response = await request(app).get("/protected").set("Authorization", "Bearer valid-token");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ user: decodedToken });
        expect(mockVerifyIdToken).toHaveBeenCalledWith("valid-token");
    });
});