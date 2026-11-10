import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api.js';

import { createProduct } from './productsApi.js';
import { toAmazonUrl, validateProductInput, validateProductName } from './validation.js';

const GENERIC_ERROR = 'We couldn’t add that product right now. Please try again.';

export default function AddProductForm({ onProductAdded }) {
  const nameRef = useRef(null);
  const linkRef = useRef(null);
  const [productName, setProductName] = useState('');
  const [productLink, setProductLink] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function setFieldError(field, message) {
    setErrors((current) => ({ ...current, [field]: message }));
  }

  function handleNameChange(event) {
    const value = event.target.value;
    setProductName(value);
    if (errors.productName && !validateProductName(value)) {
      setFieldError('productName', '');
    }
  }

  function handleLinkChange(event) {
    const value = event.target.value;
    setProductLink(value);
    if (errors.amazonUrl && !validateProductInput(value)) {
      setFieldError('amazonUrl', '');
    }
  }

  function showFailure(error) {
    if (!(error instanceof ApiError)) {
      setFormError(GENERIC_ERROR);
      return;
    }

    const fieldErrors = {};
    for (const detail of error.details ?? []) {
      if (detail.field === 'productName' || detail.field === 'amazonUrl') {
        fieldErrors[detail.field] = detail.message;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setFormError(error.message);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const nextErrors = {
      productName: validateProductName(productName),
      amazonUrl: validateProductInput(productLink),
    };
    setErrors(nextErrors);

    if (nextErrors.productName) {
      nameRef.current?.focus();
      return;
    }
    if (nextErrors.amazonUrl) {
      linkRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await createProduct({
        productName: productName.trim(),
        amazonUrl: toAmazonUrl(productLink),
      });
      setSuccessMessage(`Added “${productName.trim()}”.`);
      setProductName('');
      setProductLink('');
      setErrors({});
      onProductAdded?.();
    } catch (error) {
      showFailure(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormField label="Product name" htmlFor="productName" error={errors.productName}>
        <Input
          id="productName"
          name="productName"
          autoComplete="off"
          placeholder="Echo Dot (5th Gen)"
          autoFocus
          ref={nameRef}
          value={productName}
          onChange={handleNameChange}
          onBlur={() => setFieldError('productName', validateProductName(productName))}
          disabled={submitting}
          aria-invalid={Boolean(errors.productName)}
        />
      </FormField>

      <FormField
        label="Amazon product link or ASIN"
        htmlFor="amazonUrl"
        error={errors.amazonUrl}
        description="Paste a link containing /dp/ or a 10-character ASIN."
      >
        <Input
          id="amazonUrl"
          name="amazonUrl"
          autoComplete="off"
          placeholder="https://www.amazon.com/dp/B0…"
          ref={linkRef}
          value={productLink}
          onChange={handleLinkChange}
          onBlur={() => setFieldError('amazonUrl', validateProductInput(productLink))}
          disabled={submitting}
          aria-invalid={Boolean(errors.amazonUrl)}
        />
      </FormField>

      <p className="text-sm text-[#6B6B6B]">Platform: Amazon</p>

      <FormAlert message={formError} />

      {successMessage && (
        <p role="status" className="text-sm text-[#16A34A]">
          {successMessage}
        </p>
      )}

      <Button type="submit" className="h-10 w-fit px-4" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add product'}
      </Button>
    </form>
  );
}
