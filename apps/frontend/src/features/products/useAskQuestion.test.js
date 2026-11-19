import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import { askQuestion } from './productsApi.js';
import { useAskQuestion } from './useAskQuestion.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useAskQuestion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useAskQuestion('p1'));
    expect(result.current.status).toBe('idle');
    expect(result.current.answer).toBe('');
  });

  it('sends the trimmed question for the active product and shows the answer', async () => {
    askQuestion.mockResolvedValue({ answer: 'Battery life is the top complaint.' });
    const { result } = renderHook(() => useAskQuestion('p1'));

    await act(() => result.current.ask('  What do people dislike?  '));

    expect(askQuestion).toHaveBeenCalledWith('p1', 'What do people dislike?');
    expect(result.current.status).toBe('success');
    expect(result.current.question).toBe('What do people dislike?');
    expect(result.current.answer).toBe('Battery life is the top complaint.');
  });

  it('shows loading while waiting', async () => {
    const pending = deferred();
    askQuestion.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useAskQuestion('p1'));

    let call;
    act(() => {
      call = result.current.ask('Is it loud?');
    });
    expect(result.current.status).toBe('loading');

    await act(async () => {
      pending.resolve({ answer: 'No.' });
      await call;
    });
    expect(result.current.status).toBe('success');
  });

  it('does not send a blank question', async () => {
    const { result } = renderHook(() => useAskQuestion('p1'));

    let sent;
    await act(async () => {
      sent = await result.current.ask('   ');
    });

    expect(sent).toBe(false);
    expect(askQuestion).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('shows the server message on an API error', async () => {
    askQuestion.mockRejectedValue(
      new ApiError({ status: 409, code: 'NO_REVIEWS', message: 'Import reviews first.' }),
    );
    const { result } = renderHook(() => useAskQuestion('p1'));

    await act(() => result.current.ask('Any complaints?'));

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('Import reviews first.');
  });

  it('shows a generic message on an unexpected error', async () => {
    askQuestion.mockRejectedValue(new Error('socket hang up'));
    const { result } = renderHook(() => useAskQuestion('p1'));

    await act(() => result.current.ask('Any complaints?'));

    expect(result.current.errorMessage).toBe(
      "We couldn't get an answer right now. Please try again.",
    );
  });

  it('clears the old answer when the product changes (S2-018)', async () => {
    askQuestion.mockResolvedValue({ answer: 'Answer about A' });
    const { result, rerender } = renderHook(({ id }) => useAskQuestion(id), {
      initialProps: { id: 'productA' },
    });

    await act(() => result.current.ask('Question about A'));
    expect(result.current.answer).toBe('Answer about A');

    rerender({ id: 'productB' });

    expect(result.current.status).toBe('idle');
    expect(result.current.answer).toBe('');
  });

  it('sends new questions to the new product after a switch (S2-018)', async () => {
    askQuestion.mockResolvedValue({ answer: 'ok' });
    const { result, rerender } = renderHook(({ id }) => useAskQuestion(id), {
      initialProps: { id: 'productA' },
    });

    rerender({ id: 'productB' });
    await act(() => result.current.ask('Anything?'));

    expect(askQuestion).toHaveBeenLastCalledWith('productB', 'Anything?');
  });

  it('ignores a late answer for the previous product (S2-019)', async () => {
    const slowA = deferred();
    askQuestion.mockReturnValueOnce(slowA.promise);
    const { result, rerender } = renderHook(({ id }) => useAskQuestion(id), {
      initialProps: { id: 'productA' },
    });

    let call;
    act(() => {
      call = result.current.ask('Question about A');
    });
    rerender({ id: 'productB' });

    await act(async () => {
      slowA.resolve({ answer: 'Answer about A' });
      await call;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.answer).toBe('');
  });

  it('ignores a late answer even after switching back to the same product (S2-019)', async () => {
    const slowA = deferred();
    askQuestion.mockReturnValueOnce(slowA.promise);
    const { result, rerender } = renderHook(({ id }) => useAskQuestion(id), {
      initialProps: { id: 'productA' },
    });

    let call;
    act(() => {
      call = result.current.ask('Old question');
    });
    rerender({ id: 'productB' });
    rerender({ id: 'productA' });

    await act(async () => {
      slowA.resolve({ answer: 'Stale answer' });
      await call;
    });

    expect(result.current.answer).toBe('');
  });

  it('keeps only the newest answer when two questions overlap', async () => {
    const first = deferred();
    const second = deferred();
    askQuestion.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useAskQuestion('p1'));

    let call1;
    let call2;
    act(() => {
      call1 = result.current.ask('First');
    });
    act(() => {
      call2 = result.current.ask('Second');
    });

    await act(async () => {
      second.resolve({ answer: 'Second answer' });
      await call2;
      first.resolve({ answer: 'First answer' });
      await call1;
    });

    expect(result.current.answer).toBe('Second answer');
  });

  it('reset clears the answer', async () => {
    askQuestion.mockResolvedValue({ answer: 'Something' });
    const { result } = renderHook(() => useAskQuestion('p1'));

    await act(() => result.current.ask('Q'));
    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.answer).toBe('');
  });
});
