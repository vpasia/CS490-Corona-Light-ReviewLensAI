import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

import AuthLayout from './AuthLayout.jsx';
import { getAuthErrorMessage } from './authErrors.js';
import { useAuth } from './useAuth.js';
import { validateEmail } from './validation.js';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const emailRef = useRef(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function handleEmailChange(event) {
    const value = event.target.value;
    setEmail(value);
    if (emailError && !validateEmail(value)) {
      setEmailError('');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const error = validateEmail(email);
    setEmailError(error);
    if (error) {
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        setSent(true);
      } else {
        setFormError(getAuthErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        description={`If an account exists for ${email.trim()}, we’ve sent a link to reset your password.`}
      >
        <Link to="/login" className="text-sm text-[#4F46E5] hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we’ll send you a link to reset it."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Email" htmlFor="email" error={emailError}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            autoFocus
            ref={emailRef}
            value={email}
            onChange={handleEmailChange}
            onBlur={() => setEmailError(validateEmail(email))}
            disabled={submitting}
            aria-invalid={Boolean(emailError)}
          />
        </FormField>

        <FormAlert message={formError} />

        <Button type="submit" className="h-10 w-fit px-4" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>

        <Link to="/login" className="text-sm text-[#4F46E5] hover:underline">
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}
