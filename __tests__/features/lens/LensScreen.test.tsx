import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { searchLens } from '@/api/endpoints/lens';
import type { LensSearchResult } from '@/api/models';
import { LensScreen } from '@/features/lens/LensScreen';
import { addPhotos } from '@/features/wardrobe/addItem';

import { lensRegion, lensResult, lensSearch, listItem, wardrobeSummary } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/lens');
jest.mock('@/features/wardrobe/addItem', () => ({
  ...jest.requireActual('@/features/wardrobe/addItem'),
  addPhotos: jest.fn(async () => []),
}));

const searchMock = jest.mocked(searchLens);
const library = jest.mocked(ImagePicker.launchImageLibraryAsync);
const camera = jest.mocked(ImagePicker.launchCameraAsync);
const manipulate = jest.mocked(ImageManipulator.manipulateAsync);

function picked(uri = 'file://street.jpg') {
  return {
    canceled: false,
    assets: [{ uri, width: 3000, height: 4000 }],
  } as unknown as ImagePicker.ImagePickerResult;
}

const coat = listItem({ id: 'p-coat', name: 'Kaşe kaban' });
const jeans = listItem({ id: 'p-jeans', name: 'Düz paça jean' });

const twoRegions = lensSearch({
  regions: [
    lensRegion({
      index: 1,
      family: 'Outerwear',
      results: [lensResult({ product: coat, level: 'close' })],
    }),
    lensRegion({
      index: 0,
      family: 'Bottom',
      box: { x: 0.2, y: 0.6, w: 0.4, h: 0.35 },
      results: [lensResult({ product: jeans, level: 'similar', offer: null })],
    }),
  ],
});

function eventCalls(name: string) {
  return jest.mocked(track).mock.calls.filter(([event]) => event === name);
}

async function searchFromGallery(response: LensSearchResult = twoRegions) {
  searchMock.mockResolvedValueOnce(response);
  library.mockResolvedValueOnce(picked());
  await fireEvent.press(screen.getByText('Galeriden seç'));
  await screen.findByTestId('lens-region-results');
}

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  manipulate.mockImplementation(async (uri: string) => ({
    uri: `${uri}#jpeg`,
    width: 1200,
    height: 1600,
  }));
});

describe('LensScreen', () => {
  it('starts on capture with two buttons and reports lens_open with its entry', async () => {
    await renderWithQuery(<LensScreen entry="explore" />);

    expect(screen.getByText('Fotoğraf çek')).toBeTruthy();
    expect(screen.getByText('Galeriden seç')).toBeTruthy();
    expect(screen.getByText('Sokakta, ekranda, askıda — fark etmez.')).toBeTruthy();
    expect(eventCalls('lens_open')).toEqual([['lens_open', { entry: 'explore' }]]);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('counts an unknown entry as "other"', async () => {
    await renderWithQuery(<LensScreen entry="somewhere" />);
    expect(eventCalls('lens_open')).toEqual([['lens_open', { entry: 'other' }]]);
  });

  it('shows the photo under "Parçalar aranıyor…" while the downscaled photo is searched', async () => {
    searchMock.mockReturnValueOnce(new Promise(() => {}));
    camera.mockResolvedValueOnce(picked('file://camera.jpg'));
    await renderWithQuery(<LensScreen />);

    await fireEvent.press(screen.getByText('Fotoğraf çek'));

    expect(await screen.findByText('Parçalar aranıyor…')).toBeTruthy();
    expect(screen.getByTestId('lens-scanning')).toBeTruthy();
    expect(screen.queryByTestId('lens-capture')).toBeNull();
    expect(manipulate).toHaveBeenCalledWith('file://camera.jpg', [{ resize: { height: 1600 } }], {
      compress: 0.85,
      format: 'jpeg',
    });
    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith({
        uri: 'file://camera.jpg#jpeg',
        audience: undefined,
        signedIn: false,
      }),
    );
  });

  it('shows the results: outlines, the first region rail with its level label, and lens_search', async () => {
    await renderWithQuery(<LensScreen />);
    await searchFromGallery();

    expect(screen.getByTestId('lens-region-0')).toBeTruthy();
    expect(screen.getByTestId('lens-region-1')).toBeTruthy();
    expect(screen.getByText('Dış giyim')).toBeTruthy();
    expect(screen.getByText('1 benzer ürün')).toBeTruthy();
    expect(screen.getByText('Kaşe kaban')).toBeTruthy();
    expect(screen.getByText('Çok benzer')).toBeTruthy();
    expect(screen.getByText('1.899 ₺')).toBeTruthy();
    expect(screen.getByText('En ucuzu Trendyol')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
    // One primary action, plus the secondary "Yeni fotoğraf".
    expect(screen.getAllByText('Dolabıma ekle')).toHaveLength(1);
    expect(screen.getByText('Yeni fotoğraf')).toBeTruthy();

    const [, props] = eventCalls('lens_search')[0] as [string, Record<string, unknown>];
    expect(props).toMatchObject({ regionCount: 2, resultCount: 2, source: 'gallery' });
    expect(typeof props.durationMs).toBe('number');
  });

  it('switches the rail when another region is tapped', async () => {
    await renderWithQuery(<LensScreen />);
    await searchFromGallery();

    await fireEvent.press(screen.getByLabelText('2. parça: Alt'));

    expect(screen.getByText('Alt')).toBeTruthy();
    expect(screen.getByText('Düz paça jean')).toBeTruthy();
    expect(screen.queryByText('Kaşe kaban')).toBeNull();
    expect(screen.getByText('Benzer')).toBeTruthy();
    expect(screen.getByText('Şu an satışta değil')).toBeTruthy();
  });

  it('opens a result on the product screen and reports lens_result_tap', async () => {
    await renderWithQuery(<LensScreen />);
    await searchFromGallery();

    await fireEvent.press(screen.getByTestId('lens-result-p-coat'));

    expect(router.push).toHaveBeenCalledWith('/product/p-coat?source=lens');
    expect(eventCalls('lens_result_tap')).toEqual([
      ['lens_result_tap', { productId: 'p-coat', position: 0, similarity: 'close' }],
    ]);
  });

  it('shows the honest empty rail with its own "Dolabıma ekle" and no second button', async () => {
    await renderWithQuery(<LensScreen />);
    await searchFromGallery(
      lensSearch({ regions: [lensRegion({ family: 'Accessory', results: [] })] }),
    );

    expect(screen.getByText('Bu parçaya yakın bir ürün bulamadık')).toBeTruthy();
    expect(screen.getByTestId('lens-empty-rail')).toBeTruthy();
    expect(screen.getAllByText('Dolabıma ekle')).toHaveLength(1);
    expect(screen.queryByTestId('lens-rail')).toBeNull();
  });

  it('shows the "Dolabında benzeri var" strip when the region has wardrobe matches', async () => {
    await signedInSession();
    await renderWithQuery(<LensScreen />);
    await searchFromGallery(
      lensSearch({
        regions: [
          lensRegion({
            wardrobeMatches: [
              { item: wardrobeSummary({ id: 'w9' }), similarity: 0.9, match: 'exact' },
            ],
          }),
        ],
      }),
    );

    expect(screen.getByText('Dolabında benzeri var')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('lens-owned-w9'));
    expect(router.push).toHaveBeenCalledWith('/wardrobe/w9');
  });

  it('re-runs the same photo with audience=all when the audience chip is dismissed', async () => {
    await renderWithQuery(<LensScreen />);
    await searchFromGallery(lensSearch({ audience: 'Men' }));
    expect(screen.getByText('Erkek')).toBeTruthy();

    searchMock.mockResolvedValueOnce(lensSearch({ audience: null }));
    await fireEvent.press(screen.getByLabelText('Erkek filtresini kaldır'));

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
    expect(searchMock.mock.calls[1]?.[0]).toEqual({
      uri: 'file://street.jpg#jpeg',
      audience: 'all',
      signedIn: false,
    });
    // The photo that was already downscaled is sent as it is.
    expect(manipulate).toHaveBeenCalledTimes(1);
    await screen.findByTestId('lens-region-results');
    expect(screen.queryByText('Erkek')).toBeNull();
  });

  it('crops the selected region into the wardrobe flow and reports its family', async () => {
    await signedInSession();
    await renderWithQuery(<LensScreen />);
    await searchFromGallery();
    await fireEvent.press(screen.getByLabelText('2. parça: Alt'));

    await fireEvent.press(screen.getByText('Dolabıma ekle'));

    await waitFor(() => expect(addPhotos).toHaveBeenCalledTimes(1));
    // The second region's box on the 1200×1600 photo that was searched, with the 5 % margin.
    expect(manipulate).toHaveBeenLastCalledWith(
      'file://street.jpg#jpeg',
      [{ crop: { originX: 216, originY: 932, width: 528, height: 616 } }],
      { compress: 1, format: 'jpeg' },
    );
    expect(jest.mocked(addPhotos).mock.calls[0]?.[1]).toEqual([
      { uri: 'file://street.jpg#jpeg#jpeg', width: 1200, height: 1600 },
    ]);
    expect(jest.mocked(addPhotos).mock.calls[0]?.[2]).toBe('camera');
    expect(eventCalls('lens_add_to_wardrobe')).toEqual([
      ['lens_add_to_wardrobe', { family: 'Bottom' }],
    ]);
    expect(await screen.findByText('Dolabına eklendi')).toBeTruthy();
  });

  it('sends the whole photo to the wardrobe without a family', async () => {
    await signedInSession();
    await renderWithQuery(<LensScreen />);
    await searchFromGallery(
      lensSearch({
        wholePhoto: true,
        regions: [
          lensRegion({
            family: null,
            slot: null,
            category: null,
            box: { x: 0, y: 0, w: 1, h: 1 },
          }),
        ],
      }),
    );

    expect(screen.getByText('Fotoğrafın tamamı')).toBeTruthy();
    expect(screen.queryByTestId('lens-region-0')).toBeNull();
    await fireEvent.press(screen.getByText('Dolabıma ekle'));

    await waitFor(() =>
      expect(eventCalls('lens_add_to_wardrobe')).toEqual([['lens_add_to_wardrobe', {}]]),
    );
  });

  it('asks a signed-out user to sign in before adding', async () => {
    await renderWithQuery(<LensScreen />);
    await searchFromGallery();

    await fireEvent.press(screen.getByText('Dolabıma ekle'));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(addPhotos).not.toHaveBeenCalled();
  });

  it('goes back to capture with "Yeni fotoğraf"', async () => {
    await renderWithQuery(<LensScreen />);
    await searchFromGallery();

    await fireEvent.press(screen.getByText('Yeni fotoğraf'));

    expect(screen.getByTestId('lens-capture')).toBeTruthy();
  });

  it('shows the standard error with "Tekrar dene" on a 5xx and retries the same photo', async () => {
    searchMock.mockRejectedValueOnce(
      new ApiError({ status: 503, errorCode: 'Lens.VisionUnavailable', correlationId: 'c' }),
    );
    library.mockResolvedValueOnce(picked());
    await renderWithQuery(<LensScreen />);
    await fireEvent.press(screen.getByText('Galeriden seç'));

    expect(await screen.findByText('Bir şeyler ters gitti')).toBeTruthy();
    searchMock.mockResolvedValueOnce(twoRegions);
    await fireEvent.press(screen.getByText('Tekrar dene'));

    expect(await screen.findByText('Kaşe kaban')).toBeTruthy();
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('asks for another photo on a 400', async () => {
    searchMock.mockRejectedValueOnce(
      new ApiError({ status: 400, errorCode: 'Lens.UnsupportedImage', correlationId: 'c' }),
    );
    library.mockResolvedValueOnce(picked());
    await renderWithQuery(<LensScreen />);
    await fireEvent.press(screen.getByText('Galeriden seç'));

    expect(await screen.findByText('Bu fotoğrafı okuyamadık, başka bir tane dene.')).toBeTruthy();
    expect(screen.queryByText('Tekrar dene')).toBeNull();
    await fireEvent.press(screen.getByText('Yeni fotoğraf'));
    expect(screen.getByTestId('lens-capture')).toBeTruthy();
  });

  it('stays on capture when the camera is refused or closed', async () => {
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as never);
    await renderWithQuery(<LensScreen />);

    await fireEvent.press(screen.getByText('Fotoğraf çek'));

    expect(screen.getByTestId('lens-capture')).toBeTruthy();
    expect(searchMock).not.toHaveBeenCalled();
  });
});
