import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api.js';

import { listReviews } from './productsApi.js';

const LOAD_ERROR_MESSAGE = 'We couldn’t load saved reviews right now. Please try again.';
const LOADING_STATE = { status: 'loading', reviews: [], errorMessage: '' };

async function fetchReviewsState(productId) {
  try {
    const reviews = await listReviews(productId);
    return { status: 'ready', reviews: Array.isArray(reviews) ? reviews : [], errorMessage: '' };
  } catch (error) {
    return {
      status: 'error',
      reviews: [],
      errorMessage: error instanceof ApiError ? error.message : LOAD_ERROR_MESSAGE,
    };
  }
}

export function useReviews(productId) {
  const [state, setState] = useState(LOADING_STATE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;

    fetchReviewsState(productId).then((next) => {
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
