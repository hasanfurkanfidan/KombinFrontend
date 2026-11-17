import { useEffect } from 'react';

import { tr } from '@/i18n/tr';
import { announce } from '@/utils/a11y';
import { rateLimitedText } from '@/utils/rateLimit';

import { EmptyState } from './EmptyState';

interface ErrorStateProps {
  title?: string;
  body?: string;
  /** The query's error: a 429 replaces the body with "Çok fazla deneme yaptın. {n} dakika sonra tekrar dene." */
  error?: unknown;
  onRetry?: () => void;
}

export function ErrorState({
  title = tr.errorTitle,
  body = tr.errorBody,
  error,
  onRetry,
}: ErrorStateProps) {
  const text = rateLimitedText(error) ?? body;
  // An error replaces what the user was looking at: say so, once, with the sentence that tells what to do.
  useEffect(() => {
    announce(`${title}. ${text}`);
  }, [title, text]);
  return (
    <EmptyState
      title={title}
      body={text}
      action={onRetry ? { label: tr.retry, onPress: onRetry } : undefined}
    />
  );
}
