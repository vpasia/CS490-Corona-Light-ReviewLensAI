import { useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

import AuthLayout from './AuthLayout.jsx';
import { getAuthErrorMessage } from './authErrors.js';
import { useAuth } from './useAuth.js';
import { validateEmail, validateNewPassword } from './validation.js';

export default function RegisterPage() {
  const { user, loading, register, loginWithGoogle } = useAuth();
  const location = useLocation();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from?.pathname ?? '/';

  if (loading) {
    return null;
  }
  if (user) {
    return <Navigate to={destination} replace />;
  }

  function setFieldError(field, message) {
    setErrors((current) => ({ ...current, [field]: message }));
  }

  function handleEmailChange(event) {
    const value = event.target.value;
    setEmail(value);
    if (errors.email && !validateEmail(value)) {
      setFieldError('email', '');
    }
  }

  function handlePasswordChange(event) {
    const value = event.target.value;
    setPassword(value);
    if (errors.password && !validateNewPassword(value)) {
      setFieldError('password', '');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const nextErrors = {
      email: validateEmail(email),
      password: validateNewPassword(password),
    };
    setErrors(nextErrors);

    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim(), password);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setFormError('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Create an account to start analyzing product reviews."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Email" htmlFor="email" error={errors.email}>
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
            onBlur={() => setFieldError('email', validateEmail(email))}
            disabled={submitting}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="password"
          error={errors.password}
          description="Use at least 8 characters."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            ref={passwordRef}
            value={password}
            onChange={handlePasswordChange}
            onBlur={() => setFieldError('password', validateNewPassword(password))}
            disabled={submitting}
            aria-invalid={Boolean(errors.password)}
          />
        </FormField>

        <FormAlert message={formError} />

        <div className="flex flex-col gap-3">
          <Button type="submit" className="h-10 w-fit px-4" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-fit px-4"
            onClick={handleGoogleSignIn}
            disabled={submitting}
          >
            Continue with Google
          </Button>
        </div>

        <p className="text-sm text-[#6B6B6B]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#4F46E5] hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
