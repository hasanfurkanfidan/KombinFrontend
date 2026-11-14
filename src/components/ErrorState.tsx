import { tr } from '@/i18n/tr';
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
  return (
    <EmptyState
      title={title}
      body={rateLimitedText(error) ?? body}
      action={onRetry ? { label: tr.retry, onPress: onRetry } : undefined}
    />
  );
}
