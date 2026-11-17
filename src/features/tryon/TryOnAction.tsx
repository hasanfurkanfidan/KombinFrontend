import { useState } from 'react';
import { StyleSheet } from 'react-native';

import type { TryOnSubject } from '@/api/endpoints/tryon';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';

import { TRYON_ASK_DELAY_MS, useTryOn } from './hooks';
import type { PieceNames } from './labels';
import { QuietLink } from './QuietLink';
import { TryOnPanel } from './TryOnPanel';

interface TryOnActionProps {
  subject: TryOnSubject;
  names: PieceNames;
  productName?: string;
  /** `text`: the quiet action in an outfit sheet's header. `outlined`: the secondary action on product detail. */
  variant: 'text' | 'outlined';
  /** How long the subject must stand still before it is asked about (see `useTryOn`). */
  delayMs?: number;
  testID?: string;
}

/**
 * "Manken üstünde gör". It exists only while the backend says `Ready` or `Preparing`: anything else (Unavailable, a 404, a
 * 429, an error) renders nothing, with no placeholder, no disabled state and no message. A tap opens the mannequin in a
 * sheet; the request itself was made when the surface that holds this action opened (see `useTryOn`).
 */
export function TryOnAction({
  subject,
  names,
  productName,
  variant,
  delayMs = TRYON_ASK_DELAY_MS,
  testID = 'tryon-action',
}: TryOnActionProps) {
  const state = useTryOn(subject, delayMs);
  const [open, setOpen] = useState(false);

  if (state.phase === 'hidden') {
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
