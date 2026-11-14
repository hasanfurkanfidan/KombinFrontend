import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { listProducts, searchBrands } from '@/api/endpoints/catalog';
import { listPersonas } from '@/api/endpoints/profile';
import { SEARCH_DEBOUNCE_MS } from '@/features/search/hooks';
import { SearchScreen } from '@/features/search/SearchScreen';
import { tr } from '@/i18n/tr';
import { usePrefsStore } from '@/session/prefsStore';

import { listItem, page, persona } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/profile');

const listProductsMock = jest.mocked(listProducts);
const searchBrandsMock = jest.mocked(searchBrands);

const brand = (slug: string, name: string) => ({
  id: `b-${slug}`,
  name,
  slug,
  logoUrl: null,
  websiteUrl: null,
});

const brandPage = (items: ReturnType<typeof brand>[]) => ({
  items,
  page: 1,
  pageSize: 20,
  totalCount: items.length,
});

/** The last `GET /catalog/products` query. */
const lastQuery = () => listProductsMock.mock.calls.at(-1)?.[0];

/** Types a term and lets the debounce pass. */
async function search(term: string) {
  await fireEvent.changeText(screen.getByTestId('search-input'), term);
  await act(() => new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50)));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  usePrefsStore.getState().reset();
  listProductsMock.mockResolvedValue(page([listItem()]));
  searchBrandsMock.mockResolvedValue(brandPage([]));
});

describe('SearchScreen', () => {
  it('shows a one-line hint before anything is typed, and asks nothing', async () => {
    await renderWithQuery(<SearchScreen />);

    expect(
      screen.getByText('Ürün adı, marka ya da renk yaz; sonuçlar yazarken gelir.'),
    ).toBeTruthy();
    // One character is not a search yet.
    await search('b');
    expect(screen.getByTestId('search-idle')).toBeTruthy();
    expect(listProductsMock).not.toHaveBeenCalled();
    expect(searchBrandsMock).not.toHaveBeenCalled();
  });

  it('sends one request for a burst of typing, 300 ms after the last key', async () => {
    await renderWithQuery(<SearchScreen />);
    const input = screen.getByTestId('search-input');

    await fireEvent.changeText(input, 'bl');
    await fireEvent.changeText(input, 'bla');
    await fireEvent.changeText(input, 'blaz');
    await fireEvent.changeText(input, 'blazer');
    expect(listProductsMock).not.toHaveBeenCalled();

    expect(await screen.findByText('Yün karışımlı blazer')).toBeTruthy();
    expect(listProductsMock).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toMatchObject({ Query: 'blazer', Page: 1, PageSize: 20 });
    expect(lastQuery()?.PersonaId).toBeUndefined();
  });

  it('shows up to four brand chips; a chip filters the results by that brand', async () => {
    searchBrandsMock.mockResolvedValue(
      brandPage([
        brand('mavi', 'Mavi'),
        brand('mavi-kids', 'Mavi Kids'),
        brand('mavili', 'Mavili'),
        brand('lacivert-mavi', 'Lacivert Mavi'),
        brand('mavi-ev', 'Mavi Ev'),
      ]),
    );
    await renderWithQuery(<SearchScreen />);
    await search('mavi');

    await screen.findByTestId('search-brand-mavi');
    expect(screen.queryByTestId('search-brand-mavi-ev')).toBeNull();
    expect(screen.getAllByTestId(/^search-brand-/)).toHaveLength(4);

    await fireEvent.press(screen.getByTestId('search-brand-mavi'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ Query: 'mavi', BrandSlug: 'mavi' }));
    expect(screen.getByTestId('search-filters-clear')).toBeTruthy();

    // A new term leaves the brand behind.
    await search('ceket');
    await waitFor(() => expect(lastQuery()).toMatchObject({ Query: 'ceket' }));
    expect(lastQuery()?.BrandSlug).toBeUndefined();
  });

  it('changes the query with each filter and clears them with "Temizle"', async () => {
    await renderWithQuery(<SearchScreen />);
    await search('triko');
    await screen.findByText('Yün karışımlı blazer');
    expect(screen.queryByTestId('search-filters-clear')).toBeNull();

    await fireEvent.press(screen.getByTestId('search-filter-sort'));
    await fireEvent.press(screen.getByTestId('option-priceAsc'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ Sort: 'priceAsc' }));
    expect(screen.getByTestId('search-filter-sort')).toHaveTextContent('Fiyat: düşükten yükseğe');

    await fireEvent.press(screen.getByTestId('search-filter-color'));
    await fireEvent.press(screen.getByTestId('option-Beige'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ Color: 'Beige' }));
    expect(screen.getByTestId('search-filter-color')).toHaveTextContent('Bej');

    await fireEvent.press(screen.getByTestId('search-filter-price'));
    await fireEvent.changeText(screen.getByTestId('price-min'), '500');
    await fireEvent.changeText(screen.getByTestId('price-max'), '1500');
    await fireEvent.press(screen.getByTestId('price-apply'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ MinPrice: 500, MaxPrice: 1500 }));
    expect(screen.getByTestId('search-filter-price')).toHaveTextContent('500–1.500 ₺');

    await fireEvent.press(screen.getByTestId('search-filters-clear'));
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({
        Query: 'triko',
        Sort: undefined,
        Color: undefined,
        MinPrice: undefined,
        MaxPrice: undefined,
      }),
    );
    expect(screen.queryByTestId('search-filters-clear')).toBeNull();
  });

  it('refuses a lowest price above the highest', async () => {
    await renderWithQuery(<SearchScreen />);
    await search('triko');
    await screen.findByText('Yün karışımlı blazer');
    const calls = listProductsMock.mock.calls.length;

    await fireEvent.press(screen.getByTestId('search-filter-price'));
    await fireEvent.changeText(screen.getByTestId('price-min'), '2000');
    await fireEvent.changeText(screen.getByTestId('price-max'), '500');
    await fireEvent.press(screen.getByTestId('price-apply'));

    expect(await screen.findByText('En az tutar, en çok tutardan büyük olamaz')).toBeTruthy();
    expect(listProductsMock).toHaveBeenCalledTimes(calls);
  });

  it('says nothing was found and offers a photo search', async () => {
    listProductsMock.mockResolvedValue(page([]));
    await renderWithQuery(<SearchScreen />);
    await search('zzzz');

    expect(await screen.findByText('"zzzz" için ürün bulamadık')).toBeTruthy();
    await fireEvent.press(screen.getByText('Fotoğrafla ara'));
    expect(router.push).toHaveBeenCalledWith('/lens?entry=other');
  });

  it('shows the error state and retries', async () => {
    listProductsMock.mockRejectedValueOnce(new ApiError({ status: 500, correlationId: 'c' }));
    await renderWithQuery(<SearchScreen />);
    await search('blazer');

    await fireEvent.press(await screen.findByText('Tekrar dene'));
    expect(await screen.findByText('Yün karışımlı blazer')).toBeTruthy();
  });

  it('opens a result as a search-sourced product', async () => {
    await renderWithQuery(<SearchScreen />);
    await search('blazer');

    await fireEvent.press(await screen.findByTestId('product-card-p1'));
    expect(router.push).toHaveBeenCalledWith('/product/p1?source=search');
  });

  it('adds a submitted term to the recents, searches again from one and clears them', async () => {
    await renderWithQuery(<SearchScreen />);
    const input = screen.getByTestId('search-input');

    await fireEvent.changeText(input, 'keten gömlek');
    await fireEvent(input, 'submitEditing');
    // Submitting does not wait for the debounce, and the results stay.
    expect(await screen.findByText('Yün karışımlı blazer')).toBeTruthy();
    expect(lastQuery()).toMatchObject({ Query: 'keten gömlek' });
    expect(usePrefsStore.getState().recentSearches).toEqual(['keten gömlek']);

    await fireEvent.press(screen.getByTestId('search-clear'));
    expect(await screen.findByText('Son aramalar')).toBeTruthy();
    expect(screen.getByTestId('search-input').props.value).toBe('');

    listProductsMock.mockClear();
    await fireEvent.press(screen.getByTestId('search-recent-keten gömlek'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ Query: 'keten gömlek' }));
    expect(screen.getByTestId('search-input').props.value).toBe('keten gömlek');

    await fireEvent.press(screen.getByTestId('search-clear'));
    await fireEvent.press(screen.getByTestId('search-recent-clear'));
    expect(usePrefsStore.getState().recentSearches).toEqual([]);
    expect(
      screen.getByText('Ürün adı, marka ya da renk yaz; sonuçlar yazarken gelir.'),
    ).toBeTruthy();
  });

  it('reports one search per settled term, with its length and never its text', async () => {
    await renderWithQuery(<SearchScreen />);
    await search('blazer');
    await screen.findByText('Yün karışımlı blazer');

    // A filter on the same term is not another search.
    await fireEvent.press(screen.getByTestId('search-filter-sort'));
    await fireEvent.press(screen.getByTestId('option-newest'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ Sort: 'newest' }));

    await search('ceket');
    await waitFor(() =>
      expect(jest.mocked(track).mock.calls.filter(([name]) => name === 'search')).toHaveLength(2),
    );

    const searches = jest.mocked(track).mock.calls.filter(([name]) => name === 'search');
    expect(searches).toEqual([
      ['search', { queryLength: 6 }],
      ['search', { queryLength: 5 }],
    ]);
    expect(JSON.stringify(jest.mocked(track).mock.calls)).not.toMatch(/blazer|ceket/);
  });

  it('searches with the active style when signed in', async () => {
    await signedInSession();
    jest
      .mocked(listPersonas)
      .mockResolvedValue({ items: [persona({ id: 'pe1', isActive: true })] });
    await renderWithQuery(<SearchScreen />);
    await search('blazer');

    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ Query: 'blazer', PersonaId: 'pe1', Sort: 'match' }),
    );
    expect(listProductsMock).toHaveBeenCalledTimes(1);
  });
});

describe('popular searches', () => {
  it('lists the eight static terms as chips when nothing is typed and there are no recents', async () => {
    await renderWithQuery(<SearchScreen />);

    expect(screen.getByText('Popüler aramalar')).toBeTruthy();
    expect(tr.searchPopular).toHaveLength(8);
    for (const term of tr.searchPopular) {
      expect(screen.getByTestId(`search-popular-${term}`)).toBeTruthy();
    }
    expect(screen.queryByText('Son aramalar')).toBeNull();
    expect(listProductsMock).not.toHaveBeenCalled();
  });

  it('searches the term and fills the field when a chip is tapped', async () => {
    await renderWithQuery(<SearchScreen />);

    await fireEvent.press(screen.getByTestId('search-popular-trençkot'));

    await waitFor(() => expect(lastQuery()).toMatchObject({ Query: 'trençkot' }));
    expect(screen.getByTestId('search-input').props.value).toBe('trençkot');
    expect(screen.queryByTestId('search-popular')).toBeNull();
  });

  it('shows the recents first, then the popular terms', async () => {
    usePrefsStore.getState().addRecentSearch('mavi ceket');
    await renderWithQuery(<SearchScreen />);

    expect(screen.getByTestId('search-recent-mavi ceket')).toBeTruthy();
    // Document order of the two headings: recents, then popular.
    const headings = screen
      .getAllByText(/^(Son aramalar|Popüler aramalar)$/)
      .map((node) => node.props.children);
    expect(headings).toEqual(['Son aramalar', 'Popüler aramalar']);
  });
});

describe('recent searches', () => {
  beforeEach(() => usePrefsStore.getState().reset());

  it('keeps the newest eight, without case-insensitive duplicates', () => {
    const { addRecentSearch } = usePrefsStore.getState();
    for (const term of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9']) {
      addRecentSearch(term);
    }
    addRecentSearch('  A5 ');

    expect(usePrefsStore.getState().recentSearches).toEqual([
      'A5',
      'a9',
      'a8',
      'a7',
      'a6',
      'a4',
      'a3',
      'a2',
    ]);
  });
});
