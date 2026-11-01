import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { getMe } from '@/api/endpoints/auth';
import { listCategories, listProducts } from '@/api/endpoints/catalog';
import { listSavedIds, saveProduct, unsaveProduct } from '@/api/endpoints/engagement';
import { activatePersona, listPersonas } from '@/api/endpoints/profile';
import { DiscoverScreen } from '@/features/catalog/DiscoverScreen';

import { categories, listItem, page, persona } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/auth');
jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/engagement');
jest.mock('@/api/endpoints/profile');

const listProductsMock = jest.mocked(listProducts);
const listPersonasMock = jest.mocked(listPersonas);
const activateMock = jest.mocked(activatePersona);
const listSavedIdsMock = jest.mocked(listSavedIds);
const saveMock = jest.mocked(saveProduct);
const unsaveMock = jest.mocked(unsaveProduct);

const personas = [
  persona({ id: 'pe1', name: 'Ofis', isActive: true }),
  persona({ id: 'pe2', name: 'Hafta sonu', isActive: false }),
];

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(listCategories).mockResolvedValue(categories);
  jest.mocked(getMe).mockResolvedValue({
    id: 'u1',
    email: 'furkan@example.com',
    displayName: 'Furkan Fidan',
    createdAt: '2026-11-01T10:00:00Z',
  });
  listPersonasMock.mockResolvedValue({ items: personas });
  listSavedIdsMock.mockResolvedValue({ productIds: [] });
  listProductsMock.mockResolvedValue(
    page([
      listItem({ id: 'p1', matchScore: 94 }),
      listItem({ id: 'p2', name: 'Bej boğazlı triko', matchScore: 39 }),
      listItem({ id: 'p3', name: 'Siyah pantolon', matchScore: null }),
    ]),
  );
});

describe('Keşfet with a persona', () => {
  it('shows the persona chips with the active one selected, plus the dashed "+" chip', async () => {
    await signedInSession();

    await renderWithQuery(<DiscoverScreen />);

    const active = await screen.findByTestId('persona-chip-pe1');
    expect(active.props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('persona-chip-pe2').props.accessibilityState.selected).toBe(false);
    expect(screen.getByText('Hafta sonu')).toBeTruthy();
    expect(screen.getByTestId('persona-add')).toBeTruthy();
  });

  it('queries with the active persona and sorts by match by default', async () => {
    await signedInSession();

    await renderWithQuery(<DiscoverScreen />);
    await screen.findByTestId('product-card-p1');

    expect(listProductsMock.mock.calls[0]?.[0]).toMatchObject({ PersonaId: 'pe1', Sort: 'match' });
    // Signed-in users wait for their personas, so the list is fetched once.
    expect(listProductsMock).toHaveBeenCalledTimes(1);
  });

  it('shows the match badge from 40 up and hides lower or missing scores', async () => {
    await signedInSession();

    await renderWithQuery(<DiscoverScreen />);

    expect(await screen.findByText('%94 uyum')).toBeTruthy();
    expect(screen.getByTestId('match-badge-p1')).toBeTruthy();
    expect(screen.queryByTestId('match-badge-p2')).toBeNull();
    expect(screen.queryByTestId('match-badge-p3')).toBeNull();
    // The discount pill stays on the other corner.
    expect(screen.getAllByText('−28%').length).toBeGreaterThan(0);
  });

  it('activates another persona when its chip is pressed', async () => {
    await signedInSession();
    // Like the server: once activated, the next list says so.
    activateMock.mockImplementation(async (id) => {
      listPersonasMock.mockResolvedValue({
        items: personas.map((item) => ({ ...item, isActive: item.id === id })),
      });
    });

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('persona-chip-pe2'));

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith('pe2'));
    // The chip row switches at once (optimistic), before the refetch answers.
    await waitFor(() =>
      expect(screen.getByTestId('persona-chip-pe2').props.accessibilityState.selected).toBe(true),
    );
  });

  it('opens the new-persona flow from the "+" chip', async () => {
    await signedInSession();

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('persona-add'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/persona', params: { flow: 'new' } });
  });

  it('greets the user by first name', async () => {
    await signedInSession();

    await renderWithQuery(<DiscoverScreen />);

    expect(await screen.findByText(/^(Günaydın|İyi günler|İyi akşamlar), Furkan$/)).toBeTruthy();
  });

  it('offers "Sana göre" in the sort sheet while a persona is active', async () => {
    await signedInSession();

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('filter-sort'));

    expect(await screen.findByTestId('option-match')).toBeTruthy();
    expect(screen.getByText('Sana göre')).toBeTruthy();
  });

  it('keeps an explicit order instead of the match default', async () => {
    await signedInSession();
    jest.mocked(useLocalSearchParams).mockReturnValue({ sort: 'priceAsc' });

    await renderWithQuery(<DiscoverScreen />);
    await screen.findByTestId('product-card-p1');

    expect(listProductsMock.mock.calls[0]?.[0]).toMatchObject({
      PersonaId: 'pe1',
      Sort: 'priceAsc',
    });
  });

  it('ignores sort=match from the URL when there is no persona', async () => {
    await signedInSession();
    listPersonasMock.mockResolvedValue({ items: [] });
    jest.mocked(useLocalSearchParams).mockReturnValue({ sort: 'match' });

    await renderWithQuery(<DiscoverScreen />);
    await screen.findByTestId('product-card-p1');

    const query = listProductsMock.mock.calls[0]?.[0];
    expect(query?.Sort).toBeUndefined();
    expect(query?.PersonaId).toBeUndefined();
    expect(screen.queryByTestId('persona-chips')).toBeNull();
  });
});

describe('Keşfet logged out', () => {
  it('hides the persona row, sends no persona and shows no match badge', async () => {
    useSessionLoggedOut();

    await renderWithQuery(<DiscoverScreen />);
    await screen.findByTestId('product-card-p1');

    expect(screen.queryByTestId('persona-chips')).toBeNull();
    expect(listPersonasMock).not.toHaveBeenCalled();
    expect(listProductsMock.mock.calls[0]?.[0].PersonaId).toBeUndefined();
    expect(listProductsMock.mock.calls[0]?.[0].Sort).toBeUndefined();
  });

  it('opens login when the bookmark is tapped', async () => {
    useSessionLoggedOut();

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('save-p1-card'));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(saveMock).not.toHaveBeenCalled();
  });
});

describe('bookmark on the card', () => {
  it('saves optimistically and calls PUT /me/saved/{id}', async () => {
    await signedInSession();
    saveMock.mockImplementation(async (id) => {
      listSavedIdsMock.mockResolvedValue({ productIds: [id] });
    });

    await renderWithQuery(<DiscoverScreen />);
    const button = await screen.findByTestId('save-p1-card');
    expect(button.props.accessibilityState.selected).toBe(false);
    await fireEvent.press(button);

    await waitFor(() => expect(saveMock).toHaveBeenCalledWith('p1'));
    await waitFor(() =>
      expect(screen.getByTestId('save-p1-card').props.accessibilityState.selected).toBe(true),
    );
  });

  it('removes a saved product with DELETE', async () => {
    await signedInSession();
    listSavedIdsMock.mockResolvedValue({ productIds: ['p1'] });
    unsaveMock.mockResolvedValue(undefined);

    await renderWithQuery(<DiscoverScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('save-p1-card').props.accessibilityState.selected).toBe(true),
    );
    await fireEvent.press(screen.getByTestId('save-p1-card'));

    await waitFor(() => expect(unsaveMock).toHaveBeenCalledWith('p1'));
  });

  it('rolls back and shows a toast when saving fails', async () => {
    await signedInSession();
    saveMock.mockRejectedValue(new Error('offline'));

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('save-p1-card'));

    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('save-p1-card').props.accessibilityState.selected).toBe(false),
    );
  });
});

function useSessionLoggedOut() {
  // `resetSession` leaves the store in `booting`; a logged-out user is `signedOut`.
  const { useSessionStore } = jest.requireActual('@/session/sessionStore');
  useSessionStore.getState().setSignedOut();
}
