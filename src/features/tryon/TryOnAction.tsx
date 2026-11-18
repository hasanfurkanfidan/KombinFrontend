import { useState } from 'react';
import { StyleSheet } from 'react-native';

import type { TryOnSubject } from '@/api/endpoints/tryon';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';

import { TRYON_ASK_DELAY_MS, useTryOnAvailable, useTryOnDraw } from './hooks';
import type { PieceNames } from './labels';
import { QuietLink } from './QuietLink';
import { TryOnPanel } from './TryOnPanel';

interface TryOnActionProps {
  subject: TryOnSubject;
  names: PieceNames;
  productName?: string;
  /** `text`: the quiet action in an outfit sheet's header. `outlined`: a secondary action (unused since the product detail one was removed; it comes back when the product is asked about, see CLAUDE.md). */
  variant: 'text' | 'outlined';
  /** How long the subject must stand still before it is asked about (see `useTryOn`). */
  delayMs?: number;
  testID?: string;
}

/**
 * "Manken üstünde gör". It exists only while the backend says `Ready` or `Preparing`: anything else (Unavailable, a 404, a
 * 429, an error) renders nothing, with no placeholder, no disabled state and no message. Whether to show it is a free
 * availability check; the drawing is requested only when the user taps, and the sheet shows its shimmer meanwhile. A
 * drawing that fails closes the sheet and hides the action (see `useTryOnDraw`).
 */
export function TryOnAction({
  subject,
  names,
  productName,
  variant,
  delayMs = TRYON_ASK_DELAY_MS,
  testID = 'tryon-action',
}: TryOnActionProps) {
  const available = useTryOnAvailable(subject, delayMs);
  const [open, setOpen] = useState(false);
  const state = useTryOnDraw(subject, open, () => setOpen(false));

  if (!available) {
    return null;
  }
  const show = () => setOpen(true);
  return (
    <>
      {variant === 'text' ? (
        <QuietLink label={tr.tryOnAction} onPress={show} style={styles.text} testID={testID} />
      ) : (
        <Button label={tr.tryOnAction} variant="secondary" onPress={show} testID={testID} />
      )}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={tr.tryOnTitle}>
        <TryOnPanel
          subject={subject}
          state={state}
          names={names}
          productName={productName}
          onLeave={() => setOpen(false)}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  text: {
    alignSelf: 'flex-start',
  },
});
