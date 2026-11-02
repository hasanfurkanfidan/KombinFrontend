import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { register } from '@/api/endpoints/auth';
import { RegisterScreen } from '@/features/auth/RegisterScreen';

import { renderWithQuery, resetSession, tokens } from '../../testUtils';

jest.mock('@/api/endpoints/auth');

const registerMock = jest.mocked(register);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
});

async function fill(name: string, email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('register-name'), name);
  await fireEvent.changeText(screen.getByTestId('register-email'), email);
  await fireEvent.changeText(screen.getByTestId('register-password'), password);
  await fireEvent.press(screen.getByTestId('register-submit'));
}

describe('RegisterScreen', () => {
  it('renders the form', async () => {
    await renderWithQuery(<RegisterScreen />);

    // Title and submit button share the label.
    expect(screen.getAllByText('Hesap oluştur')).toHaveLength(2);
    expect(screen.getByText('Adın')).toBeTruthy();
    expect(screen.getByText('En az 8 karakter, bir harf ve bir rakam')).toBeTruthy();
  });

  it('validates the password rules in Turkish', async () => {
    await renderWithQuery(<RegisterScreen />);

    await fill('Ayşe', 'ayse@example.com', 'abcdefgh');

    expect(await screen.findByText('Şifre en az bir rakam içermeli')).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('registers and leaves the auth screens', async () => {
    registerMock.mockResolvedValue(tokens('a'));
    await renderWithQuery(<RegisterScreen />);

    await fill('Ayşe', 'ayse@example.com', 'sifre1234');

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(registerMock).toHaveBeenCalledWith({
      displayName: 'Ayşe',
      email: 'ayse@example.com',
      password: 'sifre1234',
      anonymousId: expect.any(String),
    });
  });

  it('puts Identity.EmailTaken on the email field', async () => {
    registerMock.mockRejectedValue(
      new ApiError({ status: 409, errorCode: 'Identity.EmailTaken', correlationId: 'c' }),
    );
    await renderWithQuery(<RegisterScreen />);

    await fill('Ayşe', 'ayse@example.com', 'sifre1234');

    expect(await screen.findByText('Bu e-posta adresiyle zaten bir hesap var')).toBeTruthy();
  });

  it('maps server field errors onto matching fields, ignoring key case', async () => {
    registerMock.mockRejectedValue(
      new ApiError({
        status: 400,
        errorCode: 'Validation.Failed',
        fieldErrors: { DisplayName: ['Name rejected by server.'] },
        correlationId: 'c',
      }),
    );
    await renderWithQuery(<RegisterScreen />);

    await fill('Ayşe', 'ayse@example.com', 'sifre1234');

    expect(await screen.findByText('Name rejected by server.')).toBeTruthy();
  });
});
