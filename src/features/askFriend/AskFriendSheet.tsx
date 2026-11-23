import { useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { track } from '@/analytics';
import type { Outfit } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { LiveText } from '@/components/LiveText';
import { OutfitMiniFigure } from '@/features/outfits/OutfitMiniFigure';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { AskOutfitPicker } from './AskOutfitPicker';
import { askErrorMessage } from './errors';
import { useAskConsent, useCreateAsk } from './hooks';
import type { AskResponse } from './types';

export interface AskFriendSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The outfit the ask starts from (option A of a pair). */
  outfit: Outfit;
}

/** The message handed to the share sheet: the server's sentence, then the link on its own line. */
export function askShareMessage(ask: Pick<AskResponse, 'shareText' | 'url'>): string {
  return ask.url ? `${ask.shareText}\n${ask.url}` : ask.shareText;
}

/**
 * "Arkadaşına sor": the outfit (or two, "Hangisi?"), the consent text while it is not accepted, and one "Paylaş" that
 * accepts, creates the ask and opens the phone's share sheet. The sheet closes when the share sheet returns.
 */
export function AskFriendSheet({ visible, onClose, outfit }: AskFriendSheetProps) {
  const consent = useAskConsent();
  const createAsk = useCreateAsk();
  const [second, setSecond] = useState<Outfit | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // A ref as well as state: a second tap in the same frame must not create a second ask.
  const busyRef = useRef(false);

  const busy = sharing || createAsk.isPending;
  // After a 409 the consent is fetched again: wait for the new version before sending it.
  const ready = consent.data !== undefined && !consent.isFetching;
  const showConsent = consent.data !== undefined && !consent.data.accepted;

  const close = () => {
    if (busyRef.current) {
      return;
    }
    setSecond(null);
    setPicking(false);
    setError(null);
    createAsk.reset();
    onClose();
  };

  const share = async () => {
    if (busyRef.current || !consent.data) {
      return;
    }
    busyRef.current = true;
    setSharing(true);
    setError(null);
    let ask: AskResponse;
    try {
      ask = await createAsk.mutateAsync({
        outfitIds: second ? [outfit.id, second.id] : [outfit.id],
        consentVersion: consent.data.version,
      });
    } catch (failure) {
      busyRef.current = false;
      setSharing(false);
      setError(askErrorMessage(failure));
      return;
    }
    track('ask_create', { askId: ask.id, kind: ask.kind });
    try {
      const result = await Share.share({ message: askShareMessage(ask) });
      if (result.action === Share.sharedAction) {
        track('ask_share', { askId: ask.id });
      }
    } catch {
      // The share sheet could not open. The ask exists and the link comes back in "Sorduklarım" (M2).
    }
    busyRef.current = false;
    setSharing(false);
    close();
  };

  const pair = second !== null;

  return (
    <BottomSheet
      visible={visible}
      onClose={picking ? () => setPicking(false) : close}
      title={picking ? tr.askPickTitle : pair ? tr.askQuestionPair : tr.askQuestionSingle}
    >
      {picking ? (
        <AskOutfitPicker
          excludeId={outfit.id}
          onPick={(picked) => {
            setSecond(picked);
            setError(null);
            setPicking(false);
          }}
          onBack={() => setPicking(false)}
        />
      ) : (
        <>
          <View style={styles.options}>
            <OptionPanel outfit={outfit} option={pair ? 'A' : null} />
            {second ? (
              <OptionPanel
                outfit={second}
                option="B"
                onRemove={busy ? undefined : () => setSecond(null)}
              />
            ) : null}
          </View>

          {pair ? null : (
            <View style={styles.chipRow}>
              <Chip
                label={tr.askAddSecond}
                accessibilityLabel={tr.askAddSecondA11y}
                leading={<Icon name="plus" size={16} color={theme.colors.ink} />}
                disabled={busy}
                onPress={() => setPicking(true)}
                testID="ask-add-second"
              />
            </View>
          )}

          {showConsent ? (
            <Text style={styles.consent} testID="ask-consent-text">
              {consent.data?.text}
            </Text>
          ) : null}

          <View style={styles.action}>
            <Button
              label={tr.askShare}
              accessibilityHint={tr.askShareHint}
              onPress={() => void share()}
              loading={busy}
              disabled={!ready}
              testID="ask-share"
            />
            {error ? (
              <View style={styles.errorRow} testID="ask-error">
                <Icon name="info" size={16} color={theme.colors.danger} />
                <LiveText style={styles.error}>{error}</LiveText>
              </View>
            ) : null}
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function OptionPanel({
  outfit,
  option,
  onRemove,
}: {
  outfit: Outfit;
  /** "A" or "B" in a pair; nothing for a single outfit. */
  option: 'A' | 'B' | null;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.panel} testID={`ask-option-${option ?? 'single'}`}>
      {option ? (
        <View style={styles.panelHeader}>
          <Text style={styles.optionLabel} accessibilityLabel={tr.askOptionA11y(option)}>
            {option}
          </Text>
          {onRemove ? (
            <IconButton
              icon="close"
              tone="onImage"
              label={tr.askRemoveSecond}
              onPress={onRemove}
              testID="ask-remove-second"
            />
          ) : null}
        </View>
      ) : null}
      <OutfitMiniFigure pieces={outfit.pieces} />
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  panel: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surface,
  },
  panelHeader: {
    alignSelf: 'stretch',
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    ...theme.typography.label,
    color: theme.colors.ink,
    paddingHorizontal: theme.spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
  },
  consent: {
    ...theme.typography.caption,
    color: theme.colors.ink2,
  },
  action: {
    gap: theme.spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    flexShrink: 1,
  },
});
