import { tr } from '@/i18n/tr';

import { EmptyState } from './EmptyState';

interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = tr.errorTitle,
  body = tr.errorBody,
  onRetry,
}: ErrorStateProps) {
  return (
    <EmptyState
      title={title}
      body={body}
      action={onRetry ? { label: tr.retry, onPress: onRetry } : undefined}
    />
  );
}
