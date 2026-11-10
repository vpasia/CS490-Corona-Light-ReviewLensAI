import { useCallback, useState } from 'react';

import { ApiError } from '@/lib/api.js';

import { importReviews } from './productsApi.js';

const IMPORT_ERROR_MESSAGE = 'We couldn’t import reviews right now. Please try again.';
const IDLE_STATE = {
  status: 'idle',
  importedCount: null,
  reused: false,
  reviewCount: null,
  errorMessage: '',
};

function toCount(value) {
  return typeof value === 'number' ? value : null;
}

export function useImportReviews(productId) {
  const [state, setState] = useState(IDLE_STATE);

  const start = useCallback(async () => {
    setState({ ...IDLE_STATE, status: 'loading' });

    try {
      const result = await importReviews(productId);
      setState({
        ...IDLE_STATE,
        status: 'success',
        importedCount: toCount(result?.savedCount),
        reused: result?.reused === true,
        reviewCount: toCount(result?.reviewCount),
      });
    } catch (error) {
      setState({
        ...IDLE_STATE,
        status: 'error',
        errorMessage: error instanceof ApiError ? error.message : IMPORT_ERROR_MESSAGE,
      });
    }
  }, [productId]);

  return { ...state, start };
}
