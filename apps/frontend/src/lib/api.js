import { signOut } from 'firebase/auth';

import { auth } from './firebase.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const FALLBACK_MESSAGE = 'We couldn’t complete that request. Please try again.';

export class ApiError extends Error {
  constructor({ status, code, message, details = [] }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) {
    return {};
  }
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function readErrorBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function parseError(response) {
  const body = await readErrorBody(response);
  const error = body?.error;

  return new ApiError({
    status: response.status,
    code: error?.code ?? 'UNKNOWN_ERROR',
    message: error?.message ?? FALLBACK_MESSAGE,
    details: error?.details ?? [],
  });
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'We couldn’t reach the server. Check your connection and try again.',
    });
  }

  if (response.status === 401) {
    await signOut(auth);
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}
