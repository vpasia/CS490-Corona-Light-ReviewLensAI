import { useCallback, useState } from 'react';

import { ApiError } from '@/lib/api.js';

import { importReviews } from './productsApi.js';

const IMPORT_ERROR_MESSAGE = 'We couldn’t import reviews right now. Please try again.';

export function useImportReviews(productId) {
  const [state, setState] = useState({ status: 'idle', importedCount: null, errorMessage: '' });

  const start = useCallback(async () => {
    setState({ status: 'loading', importedCount: null, errorMessage: '' });

    try {
      const result = await importReviews(productId);
      const importedCount = typeof result?.importedCount === 'number' ? result.importedCount : null;
      setState({ status: 'success', importedCount, errorMessage: '' });
    } catch (error) {
      setState({
        status: 'error',
        importedCount: null,
        errorMessage: error instanceof ApiError ? error.message : IMPORT_ERROR_MESSAGE,
      });
    }
  }, [productId]);

  return { ...state, start };
}
