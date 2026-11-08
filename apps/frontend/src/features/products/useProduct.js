import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api.js';

import { getProduct } from './productsApi.js';

async function fetchProductState(productId) {
  try {
    const product = await getProduct(productId);
    return { status: 'ready', product, error: null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: 'notFound', product: null, error };
    }
    return { status: 'error', product: null, error };
  }
}

export function useProduct(productId) {
  const [state, setState] = useState({ status: 'loading', product: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;

    fetchProductState(productId).then((next) => {
      if (!ignore) {
        setState(next);
      }
    });

    return () => {
      ignore = true;
    };
  }, [productId, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading', product: null, error: null });
    setAttempt((current) => current + 1);
  }, []);

  return { ...state, retry };
}
