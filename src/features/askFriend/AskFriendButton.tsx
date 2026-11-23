import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { Outfit } from '@/api/models';
import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';

import { AskFriendSheet } from './AskFriendSheet';
import { useAskFriendEnabled } from './hooks';

export interface AskFriendButtonProps {
  outfit: Outfit;
  /**
   * `secondary` (outlined) by default: the screens that hold it already have their one filled action. `quiet` is the
   * text-only link, for a row that is already full.
   */
  variant?: 'secondary' | 'quiet';
  /** For a button that shares a row with another one (see `Button`). */
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * "Arkadaşına sor" and the sheet it opens. Renders nothing until the consent answer is in, and nothing when the
 * feature is off (404 `AskFriend.Disabled`), so a screen can place it unconditionally.
 */
export function AskFriendButton({
  outfit,
  variant = 'secondary',
  wrap,
  style,
  testID = 'ask-friend-button',
}: AskFriendButtonProps) {
  const enabled = useAskFriendEnabled();
  const [open, setOpen] = useState(false);

  if (!enabled) {
    return null;
  }
  return (
    <>
      <Button
        variant={variant}
        label={tr.askFriendButton}
        accessibilityHint={tr.askFriendButtonHint}
        onPress={() => setOpen(true)}
        wrap={wrap}
        style={style}
        testID={testID}
      />
      <AskFriendSheet visible={open} onClose={() => setOpen(false)} outfit={outfit} />
    </>
  );
}
