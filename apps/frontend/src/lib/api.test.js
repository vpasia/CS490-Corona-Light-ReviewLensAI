import { signOut } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest } from './api.js';

const { mockAuth } = vi.hoisted(() => ({ mockAuth: { currentUser: null } }));

vi.mock('./firebase.js', () => ({ auth: mockAuth }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token') };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the signed-in user’s token and returns the response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest('/api/users/me');

    expect(result).toEqual({ data: { ok: true } });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('does not send a token when nobody is signed in', async () => {
    mockAuth.currentUser = null;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/users/me');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('turns an error response into an ApiError with the code, message, and details', async () => {
    const errorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields.',
        details: [{ field: 'amazonUrl', message: 'Not an Amazon link.' }],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, errorBody)));

    const error = await apiRequest('/api/products', { method: 'POST', body: {} }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Check the highlighted fields.');
    expect(error.details).toEqual([{ field: 'amazonUrl', message: 'Not an Amazon link.' }]);
  });

  it('signs the user out when the server answers 401', async () => {
    const errorBody = { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, errorBody)));

    const error = await apiRequest('/api/users/me').catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('gives a plain-language error when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await apiRequest('/api/products').catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toMatch(/couldn’t reach the server/);
  });
});
