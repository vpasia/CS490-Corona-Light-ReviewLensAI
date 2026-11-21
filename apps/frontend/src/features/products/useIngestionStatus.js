import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api.js';

import { pickLatestRun } from './ingestionRuns.js';
import { listIngestionRuns } from './productsApi.js';

const LOAD_ERROR_MESSAGE = 'We couldn’t load the import status right now. Please try again.';
const LOADING_STATE = { status: 'loading', latestRun: null, errorMessage: '' };

async function fetchIngestionState(productId) {
  try {
    const runs = await listIngestionRuns(productId);
    return { status: 'ready', latestRun: pickLatestRun(runs), errorMessage: '' };
  } catch (error) {
    return {
      status: 'error',
      latestRun: null,
      errorMessage: error instanceof ApiError ? error.message : LOAD_ERROR_MESSAGE,
    };
  }
}

export function useIngestionStatus(productId) {
  const [state, setState] = useState(LOADING_STATE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;

    fetchIngestionState(productId).then((next) => {
      if (!ignore) {
        setState(next);
      }
    });

    return () => {
      ignore = true;
    };
  }, [productId, attempt]);

  const reload = useCallback(() => {
    setState(LOADING_STATE);
    setAttempt((current) => current + 1);
  }, []);

  return { ...state, reload };
}
