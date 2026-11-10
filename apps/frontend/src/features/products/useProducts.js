import { useCallback, useEffect, useState } from 'react';

import { listProducts } from './productsApi.js';

async function fetchProductsState() {
  try {
    const products = await listProducts();
    return { status: 'ready', products, error: null };
  } catch (error) {
    return { status: 'error', products: [], error };
  }
}

export function useProducts() {
  const [state, setState] = useState({ status: 'loading', products: [], error: null });

  useEffect(() => {
    let ignore = false;

    // The state is set in a callback once the data arrives, which is the pattern the
    // react-hooks lint rule allows. The ignore flag avoids updating after unmount.
    fetchProductsState().then((next) => {
      if (!ignore) {
        setState(next);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setState(await fetchProductsState());
  }, []);

  const retry = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading' }));
    setState(await fetchProductsState());
  }, []);

  return { ...state, refresh, retry };
}
