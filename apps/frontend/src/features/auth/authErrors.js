const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': 'That email and password don’t match. Check them and try again.',
  'auth/wrong-password': 'That email and password don’t match. Check them and try again.',
  'auth/user-not-found': 'That email and password don’t match. Check them and try again.',
  'auth/invalid-email': 'That doesn’t look like an email address. Use the format name@example.com.',
  'auth/email-already-in-use': 'An account with that email already exists. Sign in instead.',
  'auth/weak-password': 'Use at least 8 characters for your password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed':
    'We couldn’t reach the sign-in service. Check your connection and try again.',
  'auth/popup-blocked':
    'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
};

const DEFAULT_AUTH_ERROR_MESSAGE = 'We couldn’t complete that right now. Please try again.';

export function getAuthErrorMessage(error) {
  const code = error?.code;
  return Object.hasOwn(AUTH_ERROR_MESSAGES, code)
    ? AUTH_ERROR_MESSAGES[code]
    : DEFAULT_AUTH_ERROR_MESSAGE;
}
