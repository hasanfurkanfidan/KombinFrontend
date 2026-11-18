import { useState } from 'react';
import { Pressable } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { getTryOn, reportTryOn } from '@/api/endpoints/tryon';
import type { TryOn } from '@/api/models';
import { useToastStore } from '@/components/toastStore';
import { resetTryOnGate } from '@/features/tryon/gate';
import { TRYON_ASK_DELAY_MS, TRYON_MAX_POLLS, TRYON_POLL_MS } from '@/features/tryon/hooks';
import { TryOnAction } from '@/features/tryon/TryOnAction';

import { flat } from '../../a11y/support';
import { renderWithQuery, resetSession, signedInSession } from '../../testUtils';
import {
  checkCalls,
  checkReady,
  drawCalls,
  flush,
  IMAGE_URL,
  mockTryOn,
  NAMES,
  preparing,
  Switcher,
  tryOn,
  unavailable,
  type Answer,
} from './support';

const getTryOnMock = jest.mocked(getTryOn);
const reportMock = jest.mocked(reportTryOn);

const apiError = (status: number, errorCode: string | null = null, retryAfterSeconds?: number) =>
  new ApiError({ status, errorCode, correlationId: 'c', retryAfterSeconds });

const action = () => screen.queryByTestId('tryon-action');
const toastId = () => useToastStore.getState().id;
const FAILED = 'İşlem yapılamadı, tekrar dene';

/** The user taps the quiet action: the sheet opens and the drawing is asked for. */
async function tap() {
  await fireEvent.press(screen.getByTestId('tryon-action'));
  await flush(0);
}

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

/** Leaves the screen and opens it again `times` times, giving each opening time to ask. */
async function reopen(times: number) {
  for (let opening = 0; opening < times; opening += 1) {
    await fireEvent.press(screen.getByTestId('toggle-screen'));
    expect(screen.queryByTestId('tryon-action')).toBeNull();
    await fireEvent.press(screen.getByTestId('toggle-screen'));
    await flush(TRYON_ASK_DELAY_MS + TRYON_POLL_MS);
  }
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  resetTryOnGate();
  useToastStore.getState().hide();
  await resetSession();
  await signedInSession();
  mockTryOn();
  reportMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('when the action shows', () => {
  it('checks only after the outfit stood still, then shows the quiet action for Ready', async () => {
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
    mockTryOn({ check: preparing() });
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);

    expect(screen.getByTestId('tryon-action')).toBeTruthy();
  });

  it('asks nothing when signed out', async () => {
    await resetSession();
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(5000);

    expect(getTryOnMock).not.toHaveBeenCalled();
    expect(action()).toBeNull();
  });
});

describe('check and draw are different requests', () => {
  it('every availability request carries { check: true }; the drawing request carries no option', async () => {
    await renderWithQuery(<Switcher ids={['o1', 'o2']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    await tap();

    expect(checkCalls()).toHaveLength(2);
    for (const call of checkCalls()) {
      expect(call[2]).toEqual({ check: true });
    }
    expect(drawCalls()).toHaveLength(1);
    expect(drawCalls()[0]?.[0]).toEqual({ kind: 'outfit', id: 'o2' });
    expect(drawCalls()[0]?.[2]).toBeUndefined();
  });

  it('makes no drawing request until the user taps, however long the sheet stays open', async () => {
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await flush(60 * 60_000);

    expect(screen.getByTestId('tryon-action')).toBeTruthy();
    expect(checkCalls()).toHaveLength(1);
    expect(drawCalls()).toHaveLength(0);
    expect(screen.queryByTestId('tryon-preparing')).toBeNull();
    expect(screen.queryByTestId('tryon-image')).toBeNull();

    await tap();
    expect(drawCalls()).toHaveLength(1);
  });

  it('while the drawing is out the panel shows the shimmer and "Hazırlanıyor", then the picture', async () => {
    let release: (answer: TryOn) => void = () => undefined;
    mockTryOn({ draw: () => new Promise<TryOn>((resolve) => (release = resolve)) });
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);

    await tap();
    expect(drawCalls()).toHaveLength(1);
    expect(screen.getByTestId('tryon-preparing')).toHaveTextContent('Hazırlanıyor');
    expect(screen.queryByTestId('tryon-image')).toBeNull();

    release(tryOn());
    await flush(0);
    expect(screen.getByTestId('tryon-image')).toBeTruthy();
    expect(screen.queryByTestId('tryon-preparing')).toBeNull();
  });

  it('a repeated tap after Ready (close and reopen) makes no second drawing request', async () => {
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await tap();
    expect(screen.getByTestId('tryon-image')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Kapat'));
    await tap();
    await fireEvent.press(screen.getByLabelText('Kapat'));
    await tap();
    await flush(5000);

    expect(screen.getByTestId('tryon-image')).toBeTruthy();
    expect(drawCalls()).toHaveLength(1);
    expect(checkCalls()).toHaveLength(1);
  });
});

describe('everything else hides it completely', () => {
  const cases: [string, Answer][] = [
    ['Unavailable', unavailable()],
    ['404 TryOn.Disabled', apiError(404, 'TryOn.Disabled')],
    ['404 TryOn.OutfitNotFound', apiError(404, 'TryOn.OutfitNotFound')],
    ['429', apiError(429, 'RateLimited', 90)],
    ['503 TryOn.RendererUnavailable', apiError(503, 'TryOn.RendererUnavailable')],
    ['a network error', apiError(0)],
    ['an unexpected error', new Error('boom')],
  ];

  it.each(cases)(
    'a check that says %s: no action, no disabled button, no message, no placeholder',
    async (_name, answer) => {
      mockTryOn({ check: answer });
      await renderWithQuery(<Switcher ids={['o1']} />);
      await flush(TRYON_ASK_DELAY_MS + 50);

      expect(getTryOnMock).toHaveBeenCalledTimes(1);
      expect(drawCalls()).toHaveLength(0);
      expect(action()).toBeNull();
      expect(screen.queryByText(/Manken/)).toBeNull();
      expect(screen.queryByText(/Hazırlanıyor/)).toBeNull();
      expect(screen.queryByText(/hata|yapılamadı|alınamadı/i)).toBeNull();
      expect(useToastStore.getState().message).toBeNull();
    },
  );

  it('an outfit that was hidden is not checked again in the session', async () => {
    mockTryOn({ check: unavailable() });
    await renderWithQuery(<Switcher ids={['o1', 'o2']} />);
    await flush(TRYON_ASK_DELAY_MS);
    expect(getTryOnMock).toHaveBeenCalledTimes(1);

    await flush(60 * 60_000);
    expect(getTryOnMock).toHaveBeenCalledTimes(1);
  });
});

describe('the asking rule', () => {
  it('waits until shuffling stops: rapid outfits cost one check, for the last one', async () => {
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
    expect(getTryOnMock.mock.calls[0]?.[2]).toEqual({ check: true });
  });

  it('keeps an answer for the session: going back to an outfit asks nothing', async () => {
    await renderWithQuery(<Switcher ids={['o1', 'o2']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    expect(getTryOnMock).toHaveBeenCalledTimes(2);

    // Two outfits are known now; asking again for either would be a render.
    await flush(10 * 60_000);
    expect(getTryOnMock).toHaveBeenCalledTimes(2);
  });

  it('a 429 on a check hides that outfit until Retry-After; another outfit is still checked', async () => {
    let first = true;
    mockTryOn({
      check: () => {
        if (first) {
          first = false;
          return Promise.reject(apiError(429, 'RateLimited', 120));
        }
        return Promise.resolve(checkReady());
      },
    });
    await renderWithQuery(<Switcher ids={['o1', 'o2']} />);
    await flush(TRYON_ASK_DELAY_MS);
    expect(checkCalls()).toHaveLength(1);
    expect(action()).toBeNull();

    // A check is free and the 429 belongs to that outfit: the next outfit is checked.
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    expect(checkCalls()).toHaveLength(2);
    expect(screen.getByTestId('tryon-action')).toBeTruthy();
  });

  it('a check that got a 429 is not repeated for that outfit before Retry-After', async () => {
    mockTryOn({ check: apiError(429, 'RateLimited', 120) });
    await renderWithQuery(<Reopenable />);
    await flush(TRYON_ASK_DELAY_MS);
    expect(checkCalls()).toHaveLength(1);

    await reopen(2);
    expect(checkCalls()).toHaveLength(1);

    await flush(121_000);
    mockTryOn();
    await reopen(1);
    expect(checkCalls()).toHaveLength(2);
    expect(screen.getByTestId('tryon-action')).toBeTruthy();
  });

  it('a 429 without Retry-After waits a long time, not zero', async () => {
    mockTryOn({ check: apiError(429, 'RateLimited') });
    await renderWithQuery(<Reopenable />);
    await flush(TRYON_ASK_DELAY_MS);
    await flush(60_000);
    await reopen(1);

    expect(checkCalls()).toHaveLength(1);
  });

  it('a switched-off server (404 TryOn.Disabled) is asked once for the whole session', async () => {
    mockTryOn({ check: apiError(404, 'TryOn.Disabled') });
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

describe('a drawing that fails', () => {
  const failures: [string, Answer][] = [
    ['rejects', new Error('boom')],
    ['answers 503', apiError(503, 'TryOn.RendererUnavailable')],
    ['answers 404 TryOn.Disabled', apiError(404, 'TryOn.Disabled')],
    ['answers Unavailable', unavailable()],
    ['answers Ready without a picture', tryOn({ imageUrl: null })],
  ];

  it.each(failures)(
    'when it %s the panel closes, the action is gone, one toast shows and the outfit is not asked again',
    async (_name, draw) => {
      mockTryOn({ draw });
      await renderWithQuery(<Reopenable />);
      await flush(TRYON_ASK_DELAY_MS);
      const before = toastId();

      await tap();

      expect(drawCalls()).toHaveLength(1);
      expect(screen.queryByTestId('tryon-preparing')).toBeNull();
      expect(screen.queryByTestId('tryon-panel')).toBeNull();
      expect(screen.queryByTestId('tryon-image')).toBeNull();
      expect(action()).toBeNull();
      expect(useToastStore.getState().message).toBe(FAILED);
      expect(toastId()).toBe(before + 1);

      await flush(60 * 60_000);
      await reopen(2);
      expect(action()).toBeNull();
      expect(checkCalls()).toHaveLength(1);
      expect(drawCalls()).toHaveLength(1);
      expect(toastId()).toBe(before + 1);
    },
  );

  it('a 429 on a drawing hides the action and blocks the next outfit’s drawing, but not its check', async () => {
    let first = true;
    mockTryOn({
      draw: () => {
        if (first) {
          first = false;
          return Promise.reject(apiError(429, 'RateLimited', 120));
        }
        return Promise.resolve(tryOn());
      },
    });
    await renderWithQuery(<Switcher ids={['o1', 'o2', 'o3']} />);
    await flush(TRYON_ASK_DELAY_MS);

    await tap();
    expect(drawCalls()).toHaveLength(1);
    expect(action()).toBeNull();
    expect(useToastStore.getState().message).toBe(FAILED);

    // The next outfit is checked as usual; its drawing waits for Retry-After and never reaches the server.
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    expect(checkCalls()).toHaveLength(2);
    expect(screen.getByTestId('tryon-action')).toBeTruthy();
    await tap();
    expect(drawCalls()).toHaveLength(1);
    expect(screen.queryByTestId('tryon-panel')).toBeNull();
    expect(action()).toBeNull();

    // After Retry-After a later outfit is drawn.
    await flush(121_000);
    await fireEvent.press(screen.getByTestId('next-outfit'));
    await flush(TRYON_ASK_DELAY_MS);
    await tap();
    expect(drawCalls()).toHaveLength(2);
    expect(screen.getByTestId('tryon-image')).toBeTruthy();
  });
});

describe('preparing', () => {
  it('shows "Hazırlanıyor" on a surface panel, polls every 3 seconds and swaps in the picture', async () => {
    let asks = 0;
    mockTryOn({
      draw: () => Promise.resolve((asks += 1) <= 2 ? preparing() : tryOn()),
    });
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await tap();
    expect(screen.getByTestId('tryon-preparing')).toHaveTextContent('Hazırlanıyor');
    expect(screen.queryByTestId('tryon-image')).toBeNull();

    await flush(TRYON_POLL_MS - 1);
    expect(drawCalls()).toHaveLength(1);
    await flush(1);
    expect(drawCalls()).toHaveLength(2);
    await flush(TRYON_POLL_MS);
    expect(drawCalls()).toHaveLength(3);
    // The answer reaches the screen a tick after the request that carried it.
    await flush(1);
    expect(screen.getByTestId('tryon-image')).toBeTruthy();
    expect(screen.queryByTestId('tryon-preparing')).toBeNull();

    // Ready stops the polling, and nothing was checked again meanwhile.
    await flush(10 * TRYON_POLL_MS);
    expect(drawCalls()).toHaveLength(3);
    expect(checkCalls()).toHaveLength(1);
  });

  it('gives up after ten polls: the panel closes, the action is hidden, one toast shows', async () => {
    mockTryOn({ draw: preparing() });
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    expect(screen.getByTestId('tryon-action')).toBeTruthy();
    const before = toastId();

    await tap();
    expect(screen.getByTestId('tryon-preparing')).toBeTruthy();
    await flush(TRYON_POLL_MS * (TRYON_MAX_POLLS + 5));

    // The first ask and ten polls: never more, however long the screen stays open.
    expect(drawCalls()).toHaveLength(1 + TRYON_MAX_POLLS);
    expect(screen.queryByTestId('tryon-preparing')).toBeNull();
    expect(action()).toBeNull();
    expect(useToastStore.getState().message).toBe(FAILED);
    expect(toastId()).toBe(before + 1);
  });

  it('after giving up it is a hidden answer for the session: opening the screen again asks nothing', async () => {
    mockTryOn({ draw: preparing() });
    await renderWithQuery(<Reopenable />);
    await flush(TRYON_ASK_DELAY_MS);
    await tap();
    await flush(TRYON_POLL_MS * (TRYON_MAX_POLLS + 2));
    expect(drawCalls()).toHaveLength(1 + TRYON_MAX_POLLS);
    const before = toastId();

    await reopen(3);

    expect(drawCalls()).toHaveLength(1 + TRYON_MAX_POLLS);
    expect(checkCalls()).toHaveLength(1);
    expect(action()).toBeNull();
    expect(toastId()).toBe(before);
  });
});

describe('the picture and what goes with it', () => {
  async function openReady(overrides: Partial<TryOn> = {}) {
    mockTryOn({ draw: tryOn(overrides) });
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await tap();
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
  async function openReady(overrides: Partial<TryOn> = {}) {
    mockTryOn({ draw: tryOn(overrides) });
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await tap();
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
      renderer: tryOn().renderer,
    });
    expect(screen.getByTestId('tryon-thanks')).toHaveTextContent('Teşekkürler');
    expect(screen.queryByTestId('tryon-report')).toBeNull();
  });

  it('reports the renderer the answer names, trimmed', async () => {
    await openReady({ renderer: '  mannequin-v6 ' });

    await fireEvent.press(screen.getByTestId('tryon-report'));
    await flush(0);

    expect(reportMock).toHaveBeenCalledWith(expect.objectContaining({ renderer: 'mannequin-v6' }));
  });

  it.each([
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
    await tap();

    expect(screen.getByTestId('tryon-thanks')).toBeTruthy();
    expect(screen.queryByTestId('tryon-report')).toBeNull();
    expect(reportMock).toHaveBeenCalledTimes(1);
    expect(drawCalls()).toHaveLength(1);
  });

  it('a failed report says so and can be tried again', async () => {
    reportMock.mockRejectedValueOnce(apiError(400, 'Validation'));
    await openReady();

    await fireEvent.press(screen.getByTestId('tryon-report'));
    await flush(0);

    expect(useToastStore.getState().message).toBe(FAILED);
    expect(screen.getByTestId('tryon-report')).toBeTruthy();
    expect(screen.queryByTestId('tryon-thanks')).toBeNull();
  });
});

describe('a product', () => {
  it('is checked and drawn with the product id and reported by it', async () => {
    mockTryOn({ draw: tryOn({ garments: [{ id: 'p1', fitLevel: 'Loose' }] }) });
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
    expect(getTryOnMock.mock.calls[0]?.[2]).toEqual({ check: true });
    expect(drawCalls()).toHaveLength(0);

    await tap();
    expect(drawCalls()[0]?.[0]).toEqual({ kind: 'product', id: 'p1' });
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
      renderer: tryOn().renderer,
    });
  });
});

describe('accessibility', () => {
  it('every control has a role and a name and is at least 44 points high; the image is described', async () => {
    mockTryOn({ draw: tryOn({ defaultedMeasurements: ['chest'] }) });
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await tap();

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
    await renderWithQuery(<Switcher ids={['o1']} />);
    await flush(TRYON_ASK_DELAY_MS);
    await tap();

    expect(screen.getByTestId('tryon-caption').props.accessibilityRole).toBeUndefined();
  });
});
