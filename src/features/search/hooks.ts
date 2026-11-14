import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { searchBrands } from '@/api/endpoints/catalog';
import { queryKeys } from '@/api/queryKeys';

/** Typing settles this long before the screen asks the backend. */
export const SEARCH_DEBOUNCE_MS = 300;
/** Shorter terms show recents or the hint instead of results. */
export const MIN_SEARCH_LENGTH = 2;
/** Brand chips shown above the results. */
export const MAX_BRAND_CHIPS = 4;

/**
 * The field's text and the term the results are for. `setText` (typing) moves the term after
 * `SEARCH_DEBOUNCE_MS` of quiet, so a burst of keystrokes is one request; `commit` (submit, a recent, clearing)
 * moves it at once.
 */
export function useSearchTerm() {
  const [text, setTextState] = useState('');
  const [term, setTerm] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => cancel, []);

  const setText = (next: string) => {
    setTextState(next);
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      setTerm(next.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  const commit = (next: string) => {
    cancel();
    setTextState(next);
    setTerm(next.trim());
  };

  return { text, term, setText, commit, active: term.length >= MIN_SEARCH_LENGTH };
}

/** Up to four brands whose name contains the term (same cache entry as the size sheet's brand search). */
export function useBrandSuggestions(term: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.brands(term),
    queryFn: ({ signal }) => searchBrands(term, signal),
    enabled,
    staleTime: 10 * 60_000,
    select: (data) => data.items.slice(0, MAX_BRAND_CHIPS),
  });
}
