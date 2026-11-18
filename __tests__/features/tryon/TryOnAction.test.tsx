import { useState } from 'react';
import { Pressable } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { getTryOn, reportTryOn } from '@/api/endpoints/tryon';
import { useToastStore } from '@/components/toastStore';
import { resetTryOnGate } from '@/features/tryon/gate';
import { TRYON_ASK_DELAY_MS, TRYON_MAX_POLLS, TRYON_POLL_MS } from '@/features/tryon/hooks';
import { TryOnAction } from '@/features/tryon/TryOnAction';

import { flat } from '../../a11y/support';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import { flush, IMAGE_URL, NAMES, preparing, Switcher, tryOn, unavailable } from './support';

const getTryOnMock = jest.mocked(getTryOn);
const reportMock = jest.mocked(reportTryOn);

const apiError = (status: number, errorCode: string | null = null, retryAfterSeconds?: number) =>
  new ApiError({ status, errorCode, correlationId: 'c', retryAfterSeconds });

const action = () => screen.queryByTestId('tryon-action');

/** A screen that can be left and opened again while the query cache lives on, as a sheet's screen is by its user. */
function Reopenable() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ekranı aç/kapat"
        onPress={() => setOpen((value) => !value)}
        testID="toggle-screen"
      />
      {open ? <Switcher ids={['o1']} /> : null}
    </>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  resetTryOnGate();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  getTryOnMock.mockResolvedValue(unavailable());
  reportMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('when the action shows', () => {
  it('asks only after the outfit stood still, then shows the quiet action for Ready', async () => {
    getTryOnMock.mockResolvedValue(tryOn());
    await renderWithQuery(<Switcher ids={['o1']} />);

    await flush(TRYON_ASK_DELAY_MS - 1);
    expect(getTryOnMock).not.toHaveBeenCalled();
    expect(action()).toBeNull();

    await flush(1);
    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(getTryOnMock.mock.calls[0]?.[0]).toEqual({ kind: 'outfit', id: 'o1' });
    expect(screen.getByTestId('tryon-action')).toHaveTextContent('Manken üstünde gör');
  });

  it('shows the action while the backend is still preparing', async () => {
    getTryOnMock.mockResolvedValue(preparing());
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);

    expect(screen.getByTestId('tryon-action')).toBeTruthy();
  });

  it('asks nothing when signed out', async () => {
    await resetSession();
    getTryOnMock.mockResolvedValue(tryOn());
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(5000);

    expect(getTryOnMock).not.toHaveBeenCalled();
    expect(action()).toBeNull();
  });
});

describe('everything else hides it completely', () => {
  const cases: [string, () => Promise<never> | Promise<unknown>][] = [
    ['Unavailable', async () => unavailable()],
    ['404 TryOn.Disabled', () => Promise.reject(apiError(404, 'TryOn.Disabled'))],
    ['404 TryOn.OutfitNotFound', () => Promise.reject(apiError(404, 'TryOn.OutfitNotFound'))],
    ['429', () => Promise.reject(apiError(429, 'RateLimited', 90))],
    [
      '503 TryOn.RendererUnavailable',
      () => Promise.reject(apiError(503, 'TryOn.RendererUnavailable')),
    ],
    ['a network error', () => Promise.reject(apiError(0))],
    ['an unexpected error', () => Promise.reject(new Error('boom'))],
  ];

  it.each(cases)(
    '%s: no action, no disabled button, no message, no placeholder',
    async (_name, answer) => {
      getTryOnMock.mockImplementation(answer as () => Promise<never>);
      await renderWithQuery(<Switcher ids={['o1']} />);
      await flush(TRYON_ASK_DELAY_MS + 50);

      expect(getTryOnMock).toHaveBeenCalledTimes(1);
      expect(action()).toBeNull();
      expect(screen.queryByText(/Manken/)).toBeNull();
      expect(screen.queryByText(/Hazırlanıyor/)).toBeNull();
      expect(screen.queryByText(/hata|yapılamadı|alınamadı/i)).toBeNull();
      expect(useToastStore.getState().message).toBeNull();
    },
  );

  it('an outfit that was hidden is not asked about again in the session', async () => {
    await renderWithQuery(<Switcher ids={['o1', 'o2']} />);
    await flush(TRYON_ASK_DELAY_MS);
    expect(getTryOnMock).toHaveBeenCalledTimes(1);

    await flush(60 * 60_000);
    expect(getTryOnMock).toHaveBeenCalledTimes(1);
  });
});

describe('the asking rule', () => {
  it('waits until shuffling stops: rapid outfits cost one request, for the last one', async () => {
    await renderWithQuery(<Switcher ids={['o1', 'o2', 'o3']} />);

    await flush(200);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(200);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS - 1);
    expect(getTryOnMock).not.toHaveBeenCalled();

    await flush(1);
    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(getTryOnMock.mock.calls[0]?.[0]).toEqual({ kind: 'outfit', id: 'o3' });
  });

  it('keeps an answer for the session: going back to an outfit asks nothing', async () => {
    getTryOnMock.mockResolvedValue(tryOn());
    await renderWithQuery(<Switcher ids={['o1', 'o2']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    expect(getTryOnMock).toHaveBeenCalledTimes(2);

    // Two outfits are known now; asking again for either would be a render.
    await flush(10 * 60_000);
    expect(getTryOnMock).toHaveBeenCalledTimes(2);
  });

  it('after a 429 nothing is asked until Retry-After has passed', async () => {
    getTryOnMock.mockRejectedValueOnce(apiError(429, 'RateLimited', 120));
    getTryOnMock.mockResolvedValue(tryOn());
    await renderWithQuery(<Switcher ids={['o1', 'o2', 'o3']} />);
    await flush(TRYON_ASK_DELAY_MS);
    expect(getTryOnMock).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    // The second outfit never reached the server, and shows nothing.
    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(action()).toBeNull();

    await flush(121_000);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    expect(getTryOnMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('tryon-action')).toBeTruthy();
  });

  it('a 429 without Retry-After waits a long time, not zero', async () => {
    getTryOnMock.mockRejectedValueOnce(apiError(429, 'RateLimited'));
    getTryOnMock.mockResolvedValue(tryOn());
    await renderWithQuery(<Switcher ids={['o1', 'o2']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(60_000);

    expect(getTryOnMock).toHaveBeenCalledTimes(1);
  });

  it('a switched-off server (404 TryOn.Disabled) is asked once for the whole session', async () => {
    getTryOnMock.mockRejectedValue(apiError(404, 'TryOn.Disabled'));
    await renderWithQuery(<Switcher ids={['o1', 'o2', 'o3']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);

    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    expect(action()).toBeNull();
  });
});

describe('preparing', () => {
  it('shows "Hazırlanıyor" on a surface panel, polls every 3 seconds and swaps in the picture', async () => {
    getTryOnMock
      .mockResolvedValueOnce(preparing())
      .mockResolvedValueOnce(preparing())
      .mockResolvedValue(tryOn());
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('tryon-action'));
    expect(screen.getByTestId('tryon-preparing')).toHaveTextContent('Hazırlanıyor');
    expect(screen.queryByTestId('tryon-image')).toBeNull();

    await flush(TRYON_POLL_MS - 1);
    expect(getTryOnMock).toHaveBeenCalledTimes(1);
    await flush(1);
    expect(getTryOnMock).toHaveBeenCalledTimes(2);
    await flush(TRYON_POLL_MS);
    expect(getTryOnMock).toHaveBeenCalledTimes(3);
    // The answer reaches the screen a tick after the request that carried it.
    await flush(1);
    expect(screen.getByTestId('tryon-image')).toBeTruthy();
    expect(screen.queryByTestId('tryon-preparing')).toBeNull();

    // Ready stops the polling.
    await flush(10 * TRYON_POLL_MS);
    expect(getTryOnMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after ten polls and hides the action', async () => {
    getTryOnMock.mockResolvedValue(preparing());
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    expect(screen.getByTestId('tryon-action')).toBeTruthy();

    await flush(TRYON_POLL_MS * (TRYON_MAX_POLLS + 5));

    // The first ask and ten polls: never more, however long the screen stays open.
    expect(getTryOnMock).toHaveBeenCalledTimes(1 + TRYON_MAX_POLLS);
    expect(action()).toBeNull();
  });

  it('after giving up it is a hidden answer for the session: opening the screen again asks nothing', async () => {
    getTryOnMock.mockResolvedValue(preparing());
    await renderWithQuery(<Reopenable />);
    await flush(TRYON_ASK_DELAY_MS);
    await flush(TRYON_POLL_MS * (TRYON_MAX_POLLS + 2));
    expect(getTryOnMock).toHaveBeenCalledTimes(1 + TRYON_MAX_POLLS);

    for (let opening = 0; opening < 3; opening += 1) {
      await fireEvent.press(screen.getByTestId('toggle-screen'));
      expect(screen.queryByTestId('tryon-action')).toBeNull();
      await fireEvent.press(screen.getByTestId('toggle-screen'));
      await flush(TRYON_ASK_DELAY_MS + TRYON_POLL_MS);
    }

    expect(getTryOnMock).toHaveBeenCalledTimes(1 + TRYON_MAX_POLLS);
    expect(action()).toBeNull();
  });
});

describe('the picture and what goes with it', () => {
  async function openReady(overrides = {}) {
    getTryOnMock.mockResolvedValue(tryOn(overrides));
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('tryon-action'));
  }

  it('shows the image on a panel with the honest label, described for a screen reader with its pieces', async () => {
    await openReady();

    const image = screen.getByTestId('tryon-image');
    expect(image.props.accessibilityLabel).toBe(
      `Manken üzerinde yaklaşık görünüm: ${Object.values(NAMES).join('; ')}`,
    );
    // The link is private and changes with every answer: the cache is keyed by its address without the signature.
    expect(image.props.source).toEqual([
      { uri: IMAGE_URL, cacheKey: 'https://img.test/private/render.webp' },
    ]);
    expect(screen.getByTestId('tryon-caption')).toHaveTextContent(
      'Manken üzerinde yaklaşık görünüm',
    );
    expect(screen.queryByText(/sanal|üstünde dene/i)).toBeNull();
  });

  it('labels each piece by its fit: Dar gelebilir, Tam bedenin, Bol gelebilir, and nothing for null', async () => {
    await openReady({
      garments: [
        { id: 'w1', fitLevel: 'Tight' },
        { id: 'w2', fitLevel: 'TrueToSize' },
        { id: 'w3', fitLevel: 'Loose' },
        { id: 'w4', fitLevel: null },
      ],
    });

    expect(screen.getByTestId('tryon-fit-w1')).toHaveTextContent(/Koyu yeşil blazer/);
    expect(screen.getByTestId('tryon-fit-w1')).toHaveTextContent(/Dar gelebilir/);
    expect(screen.getByTestId('tryon-fit-w2')).toHaveTextContent(/Tam bedenin/);
    expect(screen.getByTestId('tryon-fit-w3')).toHaveTextContent(/Bol gelebilir/);
    expect(screen.queryByTestId('tryon-fit-w4')).toBeNull();
    expect(screen.queryByText(/\?/)).toBeNull();
  });

  it('has no fit list when no piece has a fit', async () => {
    await openReady({ garments: [{ id: 'w1', fitLevel: null }] });
    expect(screen.queryByTestId('tryon-fit')).toBeNull();
  });

  it('says nothing about measurements when none were guessed', async () => {
    await openReady();
    expect(screen.queryByTestId('tryon-measurements')).toBeNull();
  });

  it('asks for measurements when the mannequin had to guess, and opens the measurements screen', async () => {
    await openReady({ defaultedMeasurements: ['chest', 'hip'] });

    expect(screen.getByTestId('tryon-measurements')).toHaveTextContent(
      /Ölçülerini ekle, manken sana benzesin/,
    );
    // The values are never shown: only the one sentence and the way to the existing screen.
    expect(screen.queryByText(/chest|hip/)).toBeNull();

    await fireEvent.press(screen.getByTestId('tryon-measurements-action'));
    expect(router.push).toHaveBeenCalledWith('/profile/sizes');
    expect(screen.queryByTestId('tryon-panel')).toBeNull();
  });
});

describe('"Yanlış görünüyor"', () => {
  // The backend refuses a report without a renderer, so the control exists only for an answer that names one.
  async function openReady(overrides = {}) {
    getTryOnMock.mockResolvedValue(tryOn({ renderer: 'mannequin-v5', ...overrides }));
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('tryon-action'));
  }

  it('sends one report with no form and the answer’s renderer, then says thanks and offers nothing more', async () => {
    await openReady();

    await fireEvent.press(screen.getByTestId('tryon-report'));
    await flush(0);

    expect(reportMock).toHaveBeenCalledTimes(1);
    expect(reportMock).toHaveBeenCalledWith({
      outfitId: 'o1',
      productId: null,
      garmentIds: ['w1', 'w2'],
      renderer: 'mannequin-v5',
    });
    expect(screen.getByTestId('tryon-thanks')).toHaveTextContent('Teşekkürler');
    expect(screen.queryByTestId('tryon-report')).toBeNull();
  });

  it.each([
    ['carries no renderer', undefined],
    ['carries a null renderer', null],
    ['carries an empty renderer', ''],
    ['carries a blank renderer', '   '],
  ])(
    'offers no report at all when the answer %s: no control, no request, no toast',
    async (_name, renderer) => {
      await openReady({ renderer });

      expect(screen.getByTestId('tryon-panel')).toBeTruthy();
      expect(screen.queryByTestId('tryon-report')).toBeNull();
      expect(screen.queryByTestId('tryon-thanks')).toBeNull();
      expect(screen.queryByText('Yanlış görünüyor')).toBeNull();
      expect(reportMock).not.toHaveBeenCalled();
      expect(useToastStore.getState().message).toBeNull();
    },
  );

  it('is not offered again for the same drawing in the session', async () => {
    await openReady();
    await fireEvent.press(screen.getByTestId('tryon-report'));
    await flush(0);

    // Close the sheet and open it again.
    await fireEvent.press(screen.getByLabelText('Kapat'));
    await fireEvent.press(screen.getByTestId('tryon-action'));

    expect(screen.getByTestId('tryon-thanks')).toBeTruthy();
    expect(screen.queryByTestId('tryon-report')).toBeNull();
    expect(reportMock).toHaveBeenCalledTimes(1);
  });

  it('a failed report says so and can be tried again', async () => {
    reportMock.mockRejectedValueOnce(apiError(400, 'Validation'));
    await openReady();

    await fireEvent.press(screen.getByTestId('tryon-report'));
    await flush(0);

    expect(useToastStore.getState().message).toBe('İşlem yapılamadı, tekrar dene');
    expect(screen.getByTestId('tryon-report')).toBeTruthy();
    expect(screen.queryByTestId('tryon-thanks')).toBeNull();
  });
});

describe('a product', () => {
  it('is asked with the product id and reported by it', async () => {
    getTryOnMock.mockResolvedValue(
      tryOn({ garments: [{ id: 'p1', fitLevel: 'Loose' }], renderer: 'mannequin-v5' }),
    );
    await renderWithQuery(
      <TryOnAction
        subject={{ kind: 'product', id: 'p1' }}
        names={{ p1: 'Yün karışımlı blazer' }}
        productName="Koton Yün karışımlı blazer"
        variant="outlined"
      />,
    );
    await flush(TRYON_ASK_DELAY_MS);

    expect(getTryOnMock.mock.calls[0]?.[0]).toEqual({ kind: 'product', id: 'p1' });
    await fireEvent.press(screen.getByTestId('tryon-action'));
    expect(screen.getByTestId('tryon-image').props.accessibilityLabel).toBe(
      'Manken üzerinde yaklaşık görünüm: Koton Yün karışımlı blazer ve dolabından parçalar',
    );
    expect(screen.getByTestId('tryon-fit-p1')).toHaveTextContent(/Bol gelebilir/);

    await fireEvent.press(screen.getByTestId('tryon-report'));
    await flush(0);
    expect(reportMock).toHaveBeenCalledWith({
      outfitId: null,
      productId: 'p1',
      garmentIds: ['p1'],
      renderer: 'mannequin-v5',
    });
  });
});

describe('accessibility', () => {
  it('every control has a role and a name and is at least 44 points high; the image is described', async () => {
    getTryOnMock.mockResolvedValue(
      tryOn({ defaultedMeasurements: ['chest'], renderer: 'mannequin-v5' }),
    );
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('tryon-action'));

    for (const id of ['tryon-action', 'tryon-measurements-action', 'tryon-report']) {
      const control = screen.getByTestId(id);
      expect(control.props.accessibilityRole).toBe('button');
      expect(String(control.props.accessibilityLabel ?? '').length).toBeGreaterThan(0);
      expect(Number(flat(control.props.style).minHeight)).toBeGreaterThanOrEqual(44);
    }
    expect(screen.getByTestId('tryon-image').props.accessibilityRole).toBe('image');
    // The "Hazırlanıyor" and "Teşekkürler" lines are live regions: they are announced without a tap.
    await fireEvent.press(screen.getByTestId('tryon-report'));
    await flush(0);
    expect(screen.getByTestId('tryon-thanks').props.accessibilityLiveRegion).toBe('polite');
  });

  it('the picture is not a button and the label under it is plain text', async () => {
    getTryOnMock.mockResolvedValue(tryOn());
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('tryon-action'));

    expect(screen.getByTestId('tryon-caption').props.accessibilityRole).toBeUndefined();
  });
});
