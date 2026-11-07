import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { listCategories } from '@/api/endpoints/catalog';
import { listSavedOutfits } from '@/api/endpoints/outfits';
import { acceptConsent, createOutfitPost, getConsent, publishPost } from '@/api/endpoints/social';
import { listWardrobeItems } from '@/api/endpoints/wardrobe';
import { CreatePostScreen } from '@/features/social/CreatePostScreen';
import { uploadPostPhoto, watchPost } from '@/features/social/createPost';
import { DEFAULT_VISIBILITY } from '@/features/social/labels';
import { VisibilityPicker } from '@/features/social/VisibilityPicker';
import { pickPhotos } from '@/features/wardrobe/picker';

import { categories, consent, outfit, post, proposal, wardrobeSummary } from '../../fixtures';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';

jest.mock('@/api/endpoints/social');
jest.mock('@/api/endpoints/catalog');
jest.mock('@/api/endpoints/outfits');
jest.mock('@/api/endpoints/wardrobe');
jest.mock('@/features/wardrobe/picker');
jest.mock('@/features/social/createPost', () => ({
  ...jest.requireActual('@/features/social/createPost'),
  uploadPostPhoto: jest.fn(),
  watchPost: jest.fn(),
}));

const getConsentMock = jest.mocked(getConsent);
const acceptMock = jest.mocked(acceptConsent);
const uploadMock = jest.mocked(uploadPostPhoto);
const watchMock = jest.mocked(watchPost);
const publishMock = jest.mocked(publishPost);
const pickMock = jest.mocked(pickPhotos);
const wardrobeMock = jest.mocked(listWardrobeItems);
const outfitPostMock = jest.mocked(createOutfitPost);
const savedOutfitsMock = jest.mocked(listSavedOutfits);

const IMAGE = { url: 'http://img.test/draft.jpg', previewUrl: null, aspect: 0.8 };

function draft(overrides: Parameters<typeof post>[0] = {}) {
  return post({
    id: 'post-1',
    status: 'Draft',
    visibility: 'Private',
    caption: null,
    image: IMAGE,
    tags: [],
    summary: { totalPrice: null, pieceCount: 0, ownedCount: null },
    publishedAt: null,
    proposals: [
      proposal({ id: 'pr1', categorySlug: 'ust-giyim/blazer', color: 'Green' }),
      proposal({ id: 'pr2', categorySlug: 'alt-giyim/pantolon', color: 'Black', y: 0.5 }),
    ],
    ...overrides,
  });
}

async function openLibraryAndGetDraft(drafted = draft()) {
  pickMock.mockResolvedValue([{ uri: 'file:///photo.heic', width: 3000, height: 4000 }]);
  uploadMock.mockResolvedValue('post-1');
  watchMock.mockResolvedValue({ kind: 'post', post: drafted });
  await fireEvent.press(await screen.findByTestId('post-source-library'));
  return screen.findByTestId('tag-editor');
}

beforeEach(async () => {
  jest.clearAllMocks();
  await resetSession();
  await signedInSession();
  getConsentMock.mockResolvedValue(consent({ acceptedAt: '2026-11-01T10:00:00Z' }));
  jest.mocked(listCategories).mockResolvedValue(categories);
  wardrobeMock.mockResolvedValue({
    items: [wardrobeSummary({ id: 'w1', name: 'Yeşil blazer' })],
    page: 1,
    pageSize: 24,
    totalCount: 1,
  });
});

describe('the consent gate', () => {
  it('shows the consent text first and uploads nothing until it is accepted', async () => {
    getConsentMock.mockResolvedValue(consent({ acceptedAt: null }));
    acceptMock.mockResolvedValue(consent({ acceptedAt: '2026-11-07T10:00:00Z' }));
    await renderWithQuery(<CreatePostScreen />);

    expect(await screen.findByTestId('consent-step')).toBeTruthy();
    expect(screen.getByTestId('consent-text')).toHaveTextContent(
      'Fotoğraftaki herkesin paylaşıma izin verdiğini onaylıyorum.',
    );
    // No way to pick a photo while the consent is open.
    expect(screen.queryByTestId('post-sources')).toBeNull();
    expect(uploadMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('consent-accept'));

    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith('2026-11-v1'));
    expect(await screen.findByTestId('post-sources')).toBeTruthy();
    expect(screen.queryByTestId('consent-step')).toBeNull();
  });

  it('skips the consent once it is accepted', async () => {
    await renderWithQuery(<CreatePostScreen />);

    expect(await screen.findByTestId('post-sources')).toBeTruthy();
    expect(screen.queryByTestId('consent-step')).toBeNull();
    expect(acceptMock).not.toHaveBeenCalled();
  });

  it('goes back to the consent when the upload is refused for a new consent version', async () => {
    await renderWithQuery(<CreatePostScreen />);
    pickMock.mockResolvedValue([{ uri: 'file:///photo.jpg' }]);
    uploadMock.mockRejectedValue(
      new ApiError({ status: 403, errorCode: 'Social.ConsentRequired', correlationId: 'c' }),
    );
    getConsentMock.mockResolvedValue(consent({ version: '2026-12-v2', acceptedAt: null }));

    await fireEvent.press(await screen.findByTestId('post-source-library'));

    expect(await screen.findByTestId('consent-step')).toBeTruthy();
    expect(watchMock).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in instead', async () => {
    await resetSession();
    await renderWithQuery(<CreatePostScreen />);

    expect(await screen.findByText('Paylaşmak için giriş yap')).toBeTruthy();
    expect(getConsentMock).not.toHaveBeenCalled();
  });
});

describe('the tag editor and publishing', () => {
  it('never lets an unconfirmed dot through: "Devam" waits, and only confirmed dots are sent', async () => {
    publishMock.mockResolvedValue(draft({ status: 'Live', visibility: 'Private' }));
    await renderWithQuery(<CreatePostScreen />);
    await openLibraryAndGetDraft();

    expect(track).toHaveBeenCalledWith('post_create_start', { kind: 'Photo', source: 'library' });
    // Two proposals, nothing confirmed: the way forward is closed.
    expect(screen.getByTestId('tag-pending')).toHaveTextContent('2 nokta onay bekliyor');
    await fireEvent.press(screen.getByTestId('tag-next'));
    expect(screen.queryByTestId('post-details')).toBeNull();

    // Dot 1 is the author's wardrobe blazer; dot 2 is not wanted and is deleted.
    await fireEvent.press(screen.getByTestId('dot-0-Wardrobe'));
    await fireEvent.press(await screen.findByTestId('pick-wardrobe-w1'));
    await fireEvent.press(screen.getByTestId('dot-remove-1'));

    expect(screen.queryByTestId('tag-pending')).toBeNull();
    await fireEvent.press(screen.getByTestId('tag-next'));
    expect(await screen.findByTestId('post-details')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('post-caption-input'), 'Ofis kombini');
    await fireEvent.press(screen.getByTestId('post-publish'));

    await waitFor(() => expect(publishMock).toHaveBeenCalledTimes(1));
    const [id, body] = publishMock.mock.calls[0] ?? [];
    expect(id).toBe('post-1');
    expect(body).toMatchObject({ caption: 'Ofis kombini', visibility: 'Private' });
    expect(body?.tags).toHaveLength(1);
    expect(body?.tags?.[0]).toMatchObject({
      kind: 'Wardrobe',
      wardrobeItemId: 'w1',
      productId: null,
      label: null,
    });
    expect(track).toHaveBeenCalledWith(
      'post_create_done',
      expect.objectContaining({
        kind: 'Photo',
        status: 'Live',
        tagCount: 1,
        visibility: 'Private',
        durationMs: expect.any(Number),
      }),
    );
    expect(await screen.findByTestId('post-done')).toBeTruthy();
  });

  it('sends an unknown piece with its optional label, and none for the dot that was deleted', async () => {
    publishMock.mockResolvedValue(draft({ status: 'Live' }));
    await renderWithQuery(<CreatePostScreen />);
    await openLibraryAndGetDraft();

    await fireEvent.press(screen.getByTestId('dot-1-Unknown'));
    await fireEvent.changeText(await screen.findByTestId('unknown-label'), 'Vintage pantolon');
    await fireEvent.press(screen.getByTestId('unknown-confirm'));
    await fireEvent.press(screen.getByTestId('dot-remove-0'));
    await fireEvent.press(screen.getByTestId('tag-next'));
    await fireEvent.press(await screen.findByTestId('post-publish'));

    await waitFor(() => expect(publishMock).toHaveBeenCalled());
    expect(publishMock.mock.calls[0]?.[1].tags).toEqual([
      expect.objectContaining({
        kind: 'Unknown',
        label: 'Vintage pantolon',
        wardrobeItemId: null,
        productId: null,
      }),
    ]);
  });

  it('adds a dot of its own, unconfirmed until it is named', async () => {
    await renderWithQuery(<CreatePostScreen />);
    await openLibraryAndGetDraft(draft({ proposals: [] }));

    // Nothing proposed: publishing with no tags is possible, an added dot closes it again.
    expect(screen.getByTestId('tag-next').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId('tag-add'));
    expect(screen.getByTestId('tag-pending')).toHaveTextContent('1 nokta onay bekliyor');
    expect(screen.getByTestId('tag-next').props.accessibilityState.disabled).toBe(true);
  });

  it('starts a shared outfit from the saved outfits, and its pieces still wait for a tap', async () => {
    savedOutfitsMock.mockResolvedValue({
      items: [outfit({ id: 'of9' })],
      page: 1,
      pageSize: 20,
      totalCount: 1,
    });
    outfitPostMock.mockResolvedValue(
      post({
        id: 'post-9',
        kind: 'Outfit',
        status: 'Draft',
        image: null,
        tags: [],
        proposals: [
          proposal({
            id: 'o1',
            source: 'Outfit',
            wardrobeItemId: 'w1',
            categorySlug: 'ust-giyim/blazer',
          }),
          proposal({
            id: 'o2',
            source: 'Outfit',
            productId: 'p5',
            categorySlug: 'alt-giyim/pantolon',
          }),
        ],
      }),
    );
    publishMock.mockResolvedValue(post({ id: 'post-9', status: 'Live' }));
    await renderWithQuery(<CreatePostScreen />);

    await fireEvent.press(await screen.findByTestId('post-source-outfit'));
    await fireEvent.press(await screen.findByTestId('post-outfit-of9'));

    expect(await screen.findByTestId('tag-editor')).toBeTruthy();
    expect(outfitPostMock).toHaveBeenCalledWith('of9');
    expect(track).toHaveBeenCalledWith('post_create_start', { kind: 'Outfit', source: 'outfit' });
    // The collage has no photo to drag dots over, and the suggestions are not confirmed yet.
    expect(screen.queryByTestId('tag-photo')).toBeNull();
    expect(screen.getByTestId('tag-pending')).toHaveTextContent('2 nokta onay bekliyor');

    await fireEvent.press(screen.getByTestId('dot-0-suggestion'));
    await fireEvent.press(screen.getByTestId('dot-1-suggestion'));
    await fireEvent.press(screen.getByTestId('tag-next'));
    await fireEvent.press(await screen.findByTestId('post-publish'));

    await waitFor(() => expect(publishMock).toHaveBeenCalled());
    expect(publishMock.mock.calls[0]?.[1].tags).toEqual([
      expect.objectContaining({ kind: 'Wardrobe', wardrobeItemId: 'w1' }),
      expect.objectContaining({ kind: 'Product', productId: 'p5' }),
    ]);
  });

  it('shows the backend\'s message for a refused photo, and says "incelemede" for a borderline one', async () => {
    await renderWithQuery(<CreatePostScreen />);
    await openLibraryWithResult(
      post({
        id: 'post-1',
        status: 'Blocked',
        statusMessage: 'Fotoğraf topluluk kurallarına uymuyor.',
        proposals: null,
      }),
    );
    expect(await screen.findByText('Fotoğraf topluluk kurallarına uymuyor.')).toBeTruthy();
    expect(track).toHaveBeenCalledWith(
      'post_create_done',
      expect.objectContaining({ status: 'Blocked', tagCount: 0 }),
    );
  });

  it('says "incelemede" for a borderline photo', async () => {
    await renderWithQuery(<CreatePostScreen />);
    await openLibraryWithResult(post({ id: 'post-1', status: 'NeedsReview', proposals: null }));
    expect(await screen.findByText(/incelemede/)).toBeTruthy();
    expect(screen.queryByTestId('tag-editor')).toBeNull();
  });
});

async function openLibraryWithResult(result: ReturnType<typeof post>) {
  pickMock.mockResolvedValue([{ uri: 'file:///photo.jpg' }]);
  uploadMock.mockResolvedValue('post-1');
  watchMock.mockResolvedValue({ kind: 'post', post: result });
  await fireEvent.press(await screen.findByTestId('post-source-library'));
}

describe('the visibility picker', () => {
  it('defaults to "Sadece ben": a new post is private', () => {
    expect(DEFAULT_VISIBILITY).toBe('Private');
  });

  it('starts the publish step on private and offers the three choices', async () => {
    publishMock.mockResolvedValue(draft({ status: 'Live' }));
    await renderWithQuery(<CreatePostScreen />);
    await openLibraryAndGetDraft(draft({ proposals: [] }));
    await fireEvent.press(screen.getByTestId('tag-next'));

    expect(await screen.findByText('Sadece ben')).toBeTruthy();
    expect(screen.getByText('Takipçilerime')).toBeTruthy();
    expect(screen.getByText('Herkese açık')).toBeTruthy();
    expect(screen.getByTestId('visibility-Private').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('visibility-Followers').props.accessibilityState.selected).toBe(
      false,
    );
    expect(screen.getByTestId('visibility-Public').props.accessibilityState.selected).toBe(false);

    // Publishing without touching it keeps it private.
    await fireEvent.press(screen.getByTestId('post-publish'));
    await waitFor(() => expect(publishMock).toHaveBeenCalled());
    expect(publishMock.mock.calls[0]?.[1].visibility).toBe('Private');
  });

  it('changes only when the author picks another', async () => {
    const onChange = jest.fn();
    await renderWithQuery(<VisibilityPicker value="Private" onChange={onChange} />);

    await fireEvent.press(screen.getByTestId('visibility-Public'));
    expect(onChange).toHaveBeenCalledWith('Public');
  });
});
