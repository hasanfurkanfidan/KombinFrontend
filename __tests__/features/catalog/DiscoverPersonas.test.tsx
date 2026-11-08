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
  it('collapses the styles into one "Tarzım: Ofis" control above a single filter row', async () => {
    await signedInSession();

    await renderWithQuery(<DiscoverScreen />);

    const control = await screen.findByTestId('style-switcher');
    expect(control).toHaveTextContent('Tarzım: Ofis');
    // No chip per style on the screen itself: they live in the sheet.
    expect(screen.queryByTestId('persona-chips')).toBeNull();
    expect(screen.queryByText('Hafta sonu')).toBeNull();
  });

  it('hides the style control when there is only one style', async () => {
    await signedInSession();
    listPersonasMock.mockResolvedValue({ items: [personas[0] as (typeof personas)[number]] });

    await renderWithQuery(<DiscoverScreen />);
    await screen.findByTestId('product-card-p1');

    expect(screen.queryByTestId('style-switcher')).toBeNull();
    // Still personalised: the one style is sent.
    expect(listProductsMock.mock.calls[0]?.[0]).toMatchObject({ PersonaId: 'pe1' });
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

    expect(await screen.findByText('Sana uygun %94')).toBeTruthy();
    expect(screen.getByTestId('match-badge-p1')).toBeTruthy();
    expect(screen.queryByTestId('match-badge-p2')).toBeNull();
    expect(screen.queryByTestId('match-badge-p3')).toBeNull();
    // The discount pill stays on the other corner.
    expect(screen.getAllByText('−28%').length).toBeGreaterThan(0);
  });

  it('switches the active style from the sheet', async () => {
    await signedInSession();
    // Like the server: once activated, the next list says so.
    activateMock.mockImplementation(async (id) => {
      listPersonasMock.mockResolvedValue({
        items: personas.map((item) => ({ ...item, isActive: item.id === id })),
      });
    });

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('style-switcher'));
    expect(screen.getByText('Hangi tarzına göre gösterelim?')).toBeTruthy();
    expect(screen.getByTestId('style-option-pe1').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('style-option-pe2'));

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith('pe2'));
    // The control switches at once (optimistic), before the refetch answers.
    await waitFor(() =>
      expect(screen.getByTestId('style-switcher')).toHaveTextContent('Tarzım: Hafta sonu'),
    );
  });

  it('opens the new-style flow from the sheet', async () => {
    await signedInSession();

    await renderWithQuery(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('style-switcher'));
    await fireEvent.press(screen.getByTestId('style-add'));

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
    expect(screen.getByText('Sana en uygun')).toBeTruthy();
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
    expect(screen.queryByTestId('style-switcher')).toBeNull();
  });
});

describe('Keşfet logged out', () => {
  it('hides the style control, sends no persona and shows no match badge', async () => {
    useSessionLoggedOut();

    await renderWithQuery(<DiscoverScreen />);
    await screen.findByTestId('product-card-p1');

    expect(screen.queryByTestId('style-switcher')).toBeNull();
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
