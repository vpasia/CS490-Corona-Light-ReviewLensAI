import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/lib/api';

import { askQuestion } from './productsApi.js';

const ASK_ERROR_MESSAGE = "We couldn't get an answer right now. Please try again.";
const IDLE_STATE = { status: 'idle', question: '', answer: '', errorMessage: '' };

export function useAskQuestion(productId) {
  const [state, setState] = useState({ ...IDLE_STATE, productId });
  const latestRequest = useRef(0);

  useEffect(() => {
    latestRequest.current += 1;
  }, [productId]);

  const ask = useCallback(
    async (rawQuestion) => {
      const question = typeof rawQuestion === 'string' ? rawQuestion.trim() : '';
      if (!question) {
        return false;
      }

      latestRequest.current += 1;
      const requestId = latestRequest.current;
      setState({ ...IDLE_STATE, productId, status: 'loading', question });

      try {
        const result = await askQuestion(productId, question);
        if (latestRequest.current !== requestId) {
          return false;
        }
        const answer = typeof result?.answer === 'string' ? result.answer : '';
        setState({ ...IDLE_STATE, productId, status: 'success', question, answer });
        return true;
      } catch (error) {
        if (latestRequest.current !== requestId) {
          return false;
        }
        setState({
          ...IDLE_STATE,
          productId,
          status: 'error',
          question,
          errorMessage: error instanceof ApiError ? error.message : ASK_ERROR_MESSAGE,
        });
        return false;
      }
    },
    [productId],
  );

  const reset = useCallback(() => {
    latestRequest.current += 1;
    setState({ ...IDLE_STATE, productId });
  }, [productId]);

  const current = state.productId === productId ? state : IDLE_STATE;

  return {
    status: current.status,
    question: current.question,
    answer: current.answer,
    errorMessage: current.errorMessage,
    ask,
    reset,
  };
}
