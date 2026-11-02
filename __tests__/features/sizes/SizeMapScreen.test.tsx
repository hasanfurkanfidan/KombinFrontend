import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { searchBrands } from '@/api/endpoints/catalog';
import { getProfile, listSizes, updateProfile, upsertSize } from '@/api/endpoints/profile';
import { SizeMapScreen } from '@/features/sizes/SizeMapScreen';
import { useSessionStore } from '@/session/sessionStore';

import { profile, sizeEntry } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/profile');

const getProfileMock = jest.mocked(getProfile);
const listSizesMock = jest.mocked(listSizes);
const updateProfileMock = jest.mocked(updateProfile);
const upsertSizeMock = jest.mocked(upsertSize);

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  getProfileMock.mockResolvedValue(profile({ hipCm: 98, birthYear: 1995 }));
  listSizesMock.mockResolvedValue({
    items: [
      sizeEntry({ id: '1', size: 'L' }),
      sizeEntry({ id: '2', group: 'Bottoms', size: '32/32' }),
      sizeEntry({ id: '3', group: 'Shoes', size: '43' }),
      sizeEntry({
        id: '4',
        brand: { id: 'b2', name: 'Zara', slug: 'zara' },
        size: 'M',
        source: 'Inferred',
      }),
    ],
  });
});

describe('SizeMapScreen', () => {
  it('shows the measurements card from the profile', async () => {
    await renderWithQuery(<SizeMapScreen />);

    expect(await screen.findByText('178')).toBeTruthy();
    expect(screen.getByText('76')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('84')).toBeTruthy();
    expect(screen.getByText('Boy cm')).toBeTruthy();
    expect(screen.getByText('Kilo kg')).toBeTruthy();
    expect(screen.getByText('ÖLÇÜLERİM')).toBeTruthy();
  });

  it('shows one table row per brand with top, bottom and shoe sizes', async () => {
    await renderWithQuery(<SizeMapScreen />);

    expect(await screen.findByTestId('size-table')).toBeTruthy();
    expect(screen.getByText('MARKA')).toBeTruthy();
    expect(screen.getByText('AYAKKABI')).toBeTruthy();
    expect(screen.getByText('Mavi')).toBeTruthy();
    expect(screen.getByText('32/32')).toBeTruthy();
    expect(screen.getByText('43')).toBeTruthy();
    expect(screen.getByText('Zara')).toBeTruthy();
    // A stored guess is marked with "?".
    expect(screen.getByText('M?')).toBeTruthy();
  });

  it('explains how inferred sizes get confirmed', async () => {
    await renderWithQuery(<SizeMapScreen />);

    expect(await screen.findByText(/İlk alışverişinden sonra "beden uydu mu\?"/)).toBeTruthy();
  });

  it('shows an empty hint without entries', async () => {
    listSizesMock.mockResolvedValue({ items: [] });

    await renderWithQuery(<SizeMapScreen />);

    expect(await screen.findByText('Henüz bir marka eklemedin')).toBeTruthy();
  });

  it('updates the measurements, keeping the ones the sheet does not edit', async () => {
    updateProfileMock.mockResolvedValue(profile());

    await renderWithQuery(<SizeMapScreen />);
    await fireEvent.press(await screen.findByTestId('measurements-edit'));
    await fireEvent.changeText(await screen.findByTestId('measurement-heightCm'), '180');
    await fireEvent.changeText(screen.getByTestId('measurement-weightKg'), '77,5');
    await fireEvent.press(screen.getByTestId('measurements-save'));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalled());
    expect(updateProfileMock.mock.calls[0]?.[0]).toEqual({
      audience: null,
      birthYear: 1995,
      heightCm: 180,
      weightKg: 77.5,
      chestCm: 100,
      waistCm: 84,
      hipCm: 98,
      shoeSizeEu: null,
      // The backend clears a city that is left out of the PUT: it travels with every measurements update.
      city: null,
    });
  });

  it('refuses values outside the backend ranges', async () => {
    await renderWithQuery(<SizeMapScreen />);
    await fireEvent.press(await screen.findByTestId('measurements-edit'));
    await fireEvent.changeText(await screen.findByTestId('measurement-heightCm'), '300');
    await fireEvent.changeText(screen.getByTestId('measurement-waistCm'), '20');
    await fireEvent.press(screen.getByTestId('measurements-save'));

    expect(await screen.findByText('120 ile 230 arasında olmalı')).toBeTruthy();
    expect(screen.getByText('50 ile 200 arasında olmalı')).toBeTruthy();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('adds a brand size through the sheet: search, group, size', async () => {
    jest.mocked(searchBrands).mockResolvedValue({
      items: [{ id: 'b9', name: 'Nike', slug: 'nike', logoUrl: null, websiteUrl: null }],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });
    upsertSizeMock.mockResolvedValue(sizeEntry({ id: '9' }));

    await renderWithQuery(<SizeMapScreen />);
    await fireEvent.press(await screen.findByTestId('size-add-brand'));
    await fireEvent.changeText(await screen.findByTestId('size-brand-search'), 'nik');
    await fireEvent.press(await screen.findByTestId('size-brand-nike'));
    await fireEvent.press(screen.getByTestId('size-group-Shoes'));
    await fireEvent.changeText(screen.getByTestId('size-value'), '43.5');
    await fireEvent.press(screen.getByTestId('size-submit'));

    await waitFor(() =>
      expect(upsertSizeMock).toHaveBeenCalledWith({
        brandSlug: 'nike',
        group: 'Shoes',
        size: '43.5',
      }),
    );
    expect(jest.mocked(searchBrands).mock.calls[0]?.[0]).toBe('nik');
  });

  it('asks for a brand and a size before saving', async () => {
    await renderWithQuery(<SizeMapScreen />);
    await fireEvent.press(await screen.findByTestId('size-add-brand'));
    await fireEvent.press(await screen.findByTestId('size-submit'));

    expect(await screen.findByText('Bir marka seç')).toBeTruthy();
    expect(screen.getByText('Bedenini gir')).toBeTruthy();
    expect(upsertSizeMock).not.toHaveBeenCalled();
  });

  it('goes back', async () => {
    await renderWithQuery(<SizeMapScreen />);
    await fireEvent.press(screen.getByTestId('sizes-back'));

    expect(router.back).toHaveBeenCalled();
  });

  it('asks a logged-out user to sign in', async () => {
    useSessionStore.getState().setSignedOut();

    await renderWithQuery(<SizeMapScreen />);

    expect((await screen.findAllByText('Giriş yap')).length).toBeGreaterThan(0);
    expect(getProfileMock).not.toHaveBeenCalled();
  });
});
