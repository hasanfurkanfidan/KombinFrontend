import { fireEvent, render, screen } from '@testing-library/react-native';

import { reportBoundaryError } from '@/errorReporting';
import { tr } from '@/i18n/tr';

import { ErrorBoundary } from '../../app/_layout';

// The providers run start-up work at import (fonts, splash, session reset): the boundary renders without them.
jest.mock('@/components/AppProviders', () => ({ AppProviders: () => null }));
jest.mock('@/errorReporting', () => ({
  ...jest.requireActual('@/errorReporting'),
  reportBoundaryError: jest.fn(),
}));

const reportMock = jest.mocked(reportBoundaryError);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the root ErrorBoundary', () => {
  const error = new Error('Cannot read property "email" of undefined at ayse@example.com');

  it('shows a calm fallback and reports the error once', async () => {
    const retry = jest.fn(() => Promise.resolve());
    const view = await render(<ErrorBoundary error={error} retry={retry} />);

    expect(screen.getByRole('header', { name: 'Bir şeyler ters gitti' })).toBeTruthy();
    expect(screen.getByText(tr.rootErrorBody)).toBeTruthy();
    expect(reportMock).toHaveBeenCalledTimes(1);
    expect(reportMock).toHaveBeenCalledWith(error);

    await view.rerender(<ErrorBoundary error={error} retry={retry} />);
    expect(reportMock).toHaveBeenCalledTimes(1);
  });

  it('never shows the error message', async () => {
    await render(<ErrorBoundary error={error} retry={jest.fn(() => Promise.resolve())} />);

    expect(screen.queryByText(error.message)).toBeNull();
    expect(screen.queryByText(/email|ayse@example\.com|undefined/)).toBeNull();
  });

  it('retries from "Tekrar dene"', async () => {
    const retry = jest.fn(() => Promise.resolve());
    await render(<ErrorBoundary error={error} retry={retry} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
