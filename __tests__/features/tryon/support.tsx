import { useState } from 'react';
import { Pressable } from 'react-native';
import { act } from '@testing-library/react-native';

import { getTryOn, type TryOnSubject } from '@/api/endpoints/tryon';
import type { TryOn } from '@/api/models';
import { TryOnAction } from '@/features/tryon/TryOnAction';

/** Moves fake time forward and lets every promise and render settle (the try-on tests run on fake timers). */
export async function flush(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
  // The effects that start a request run when the first act closes; React Query then hands the answer to React from a
  // zero-delay timer. Zero-time turns let both happen without moving the clock, so timing assertions stay exact.
  for (let turn = 0; turn < 6; turn += 1) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
  }
}

export const IMAGE_URL = 'https://img.test/private/render.webp?sig=secret-link';

export function tryOn(overrides: Partial<TryOn> = {}): TryOn {
  return {
    status: 'Ready',
    imageUrl: IMAGE_URL,
    garments: [
      { id: 'w1', fitLevel: 'Tight' },
      { id: 'w2', fitLevel: 'TrueToSize' },
    ],
    defaultedMeasurements: [],
    reason: null,
    renderer: 'mannequin-v5',
    ...overrides,
  };
}

export const unavailable = (): TryOn =>
  tryOn({
    status: 'Unavailable',
    imageUrl: null,
    garments: [],
    reason: 'PieceNotReady',
    renderer: null,
  });

export const preparing = (): TryOn =>
  tryOn({
    status: 'Preparing',
    imageUrl: null,
    garments: [],
    defaultedMeasurements: [],
    renderer: null,
  });

/** The answer to an availability check (`check: true`): status and reason only, never a picture. */
export const checkReady = (): TryOn => ({
  status: 'Ready',
  imageUrl: null,
  garments: [],
  defaultedMeasurements: [],
  reason: null,
  renderer: null,
});

/** What a mocked ask answers: a value, an error to reject with, or a function (a sequence, a request held open). */
export type Answer = TryOn | Error | ((subject: TryOnSubject) => Promise<TryOn>);

function answerWith(answer: Answer, subject: TryOnSubject): Promise<TryOn> {
  if (answer instanceof Error) {
    return Promise.reject(answer);
  }
  return typeof answer === 'function' ? answer(subject) : Promise.resolve(answer);
}

/**
 * Makes the mocked `getTryOn` answer by option: a call with `{ check: true }` gets `check`, any other call (the real
 * drawing) gets `draw`. By default every check says `Ready` and every drawing returns the `tryOn()` fixture.
 */
export function mockTryOn({
  check = checkReady(),
  draw = tryOn(),
}: { check?: Answer; draw?: Answer } = {}): void {
  jest
    .mocked(getTryOn)
    .mockImplementation((subject, _signal, options) =>
      answerWith(options?.check ? check : draw, subject),
    );
}

const callsOf = (check: boolean) =>
  jest.mocked(getTryOn).mock.calls.filter(([, , options]) => Boolean(options?.check) === check);

/** The availability checks made so far (each carried `{ check: true }`). */
export const checkCalls = () => callsOf(true);
/** The real drawing requests made so far (no `check` option). */
export const drawCalls = () => callsOf(false);

export const NAMES = { w1: 'Koyu yeşil blazer', w2: 'Siyah kumaş pantolon', w3: 'Kahverengi bot' };

/** The action for one outfit, and a button that moves to the next outfit id (what a shuffle or a swipe does). */
export function Switcher({ ids }: { ids: string[] }) {
  const [index, setIndex] = useState(0);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sonraki"
        onPress={() => setIndex((value) => Math.min(value + 1, ids.length - 1))}
        testID="next-outfit"
      />
      <TryOnAction
        subject={{ kind: 'outfit', id: ids[index] ?? ids[0] ?? '' }}
        names={NAMES}
        variant="text"
      />
    </>
  );
}
