const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value) {
  const email = value.trim();

  if (!email) {
    return 'Enter your email address.';
  }
  if (email.length > 254) {
    return 'That email address is too long.';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'That doesn’t look like an email address. Use the format name@example.com.';
  }
  return '';
}

export function validatePassword(value) {
  if (!value) {
    return 'Enter your password.';
  }
  return '';
}

export function validateNewPassword(value) {
  if (!value) {
    return 'Create a password.';
  }
  if (value.length < 8) {
    return 'Use at least 8 characters.';
  }
  return '';
}
