import { useEffect, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import type { SizePrompt, SizePromptAnswer } from '@/api/models';
import { AppImage } from '@/components/AppImage';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { TextField } from '@/components/TextField';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { rateLimitedText } from '@/utils/rateLimit';

import { isGone, useAnswerSizePrompt, useFirstSizePrompt, useSizePromptsEnabled } from './hooks';
import { initialSize } from './labels';

const MAX_SIZE_LENGTH = 20;

/** How long the confirming line replaces the row before the next question (or nothing) takes its place. */
export const CONFIRMATION_MS = 2500;

/** From this text scale on, the product name may wrap instead of being cut, so it is never lost to large text. */
const LARGE_TEXT_SCALE = 1.5;

type Answering = ReturnType<typeof useAnswerSizePrompt>;

/**
 * Keşfet's "did the size fit?" question about a product the user went to buy, above the daily outfit. It is one slim
 * row ("<ürün> — aldın mı?" with "Aldım" and "Almadım") so the outfit stays the first thing on the screen; "Aldım"
 * opens the next step in place. Absent, with no room reserved, when there is no question, the user turned them off,
 * or nobody is signed in. After an answer one confirming line takes the row's place for a moment.
 */
export function SizePromptCard() {
  const enabled = useSizePromptsEnabled();
  const prompt = useFirstSizePrompt();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // Owned here, not by the question's card: the answered question leaves the list at once and its card with it.
  const answer = useAnswerSizePrompt(setConfirmation);
  const { reset } = answer;
  const promptId = prompt?.id;

  // A failure belongs to the question it happened on.
  useEffect(() => {
    reset();
  }, [promptId, reset]);

  useEffect(() => {
    if (confirmation === null) {
      return;
    }
    const timer = setTimeout(() => setConfirmation(null), CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [confirmation]);

  if (!enabled) {
    return null;
  }
  if (confirmation !== null) {
    return <ConfirmationRow text={confirmation} />;
  }
  // Keyed by question: the next one starts on its first step with its own size.
  return prompt ? <PromptCard key={prompt.id} prompt={prompt} answer={answer} /> : null;
}

function ConfirmationRow({ text }: { text: string }) {
  return (
    <View
      style={[styles.card, styles.confirmation]}
      accessibilityLiveRegion="polite"
      testID="size-prompt-confirmation"
    >
      <Icon name="check" size={18} color={theme.colors.primary} />
      <Text style={styles.confirmationText}>{text}</Text>
    </View>
  );
}

type Step = 'ask' | 'how' | 'size';

/** The sentence under the card when saving failed (the existing error lines: rate limit, offline, generic). */
function failureText(error: unknown): string {
  if (error instanceof ApiError && error.isNetworkError) {
    return tr.errorNetwork;
  }
  return rateLimitedText(error) ?? tr.errorBody;
}

function PromptCard({ prompt, answer }: { prompt: SizePrompt; answer: Answering }) {
  const [step, setStep] = useState<Step>('ask');
  const [size, setSize] = useState(() => initialSize(prompt));
  const [sizeError, setSizeError] = useState<string | null>(null);
  const large = useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;

  // Once per question shown (the card is keyed by the question).
  useEffect(() => {
    track('size_prompt_view', { promptId: prompt.id });
  }, [prompt.id]);

  const busy = answer.isPending;
  const failed = answer.isError && !isGone(answer.error) ? failureText(answer.error) : null;
  const name = prompt.product.name;

  const send = (kind: SizePromptAnswer, chosenSize: string | null) =>
    answer.mutate({ prompt, answer: kind, size: chosenSize });

  const saveFit = () => {
    const chosen = size.trim();
    if (!chosen) {
      setSizeError(tr.sizePromptSizeRequired);
      return;
    }
    setSizeError(null);
    send('BoughtFits', chosen);
  };

  const collapsed = step === 'ask';

  return (
    <View style={styles.card} testID="size-prompt-card">
      <View style={styles.top}>
        <View style={styles.thumb}>
          {prompt.product.imageUrl ? (
            <AppImage uri={prompt.product.imageUrl} style={styles.fill} contentFit="contain" />
          ) : (
            <Icon name="shirt" size={20} color={theme.colors.control} strokeWidth={1.4} />
          )}
        </View>

        <View style={styles.text}>
          {collapsed ? (
            <>
              <View
                style={[styles.titleRow, large && styles.titleRowWrap]}
                accessible
                accessibilityRole="header"
                accessibilityLabel={`${name} ${tr.sizePromptAsk}`}
                testID="size-prompt-title"
              >
                <Text
                  style={styles.name}
                  numberOfLines={large ? undefined : 1}
                  testID="size-prompt-product"
                >
                  {name}
                </Text>
                <Text style={styles.ask}> {tr.sizePromptAsk}</Text>
              </View>
              <View style={styles.actions}>
                <Choice
                  label={tr.sizePromptBought}
                  disabled={busy}
                  onPress={() => setStep('how')}
                  testID="size-prompt-bought"
                />
                <Choice
                  label={tr.sizePromptNotBought}
                  disabled={busy}
                  onPress={() => send('NotBought', null)}
                  testID="size-prompt-not-bought"
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.caption} numberOfLines={large ? undefined : 1}>
                {name}
              </Text>
              <Text
                style={styles.question}
                accessibilityRole="header"
                testID="size-prompt-question"
              >
                {step === 'how'
                  ? tr.sizePromptHowQuestion
                  : tr.sizePromptSizeTitle(prompt.brand.name)}
              </Text>
            </>
          )}
        </View>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={tr.sizePromptNever}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => send('NeverAsk', null)}
          style={styles.close}
          testID="size-prompt-never"
        >
          <Icon name="close" size={18} color={theme.colors.muted} />
        </PressableScale>
      </View>

      {step === 'how' ? (
        <View style={styles.actions}>
          <Choice
            label={tr.sizePromptFits}
            disabled={busy}
            onPress={() => setStep('size')}
            style={styles.grow}
            testID="size-prompt-fits"
          />
          <Choice
            label={tr.sizePromptTooSmall}
            disabled={busy}
            onPress={() => send('BoughtTooSmall', null)}
            style={styles.grow}
            testID="size-prompt-small"
          />
          <Choice
            label={tr.sizePromptTooLarge}
            disabled={busy}
            onPress={() => send('BoughtTooLarge', null)}
            style={styles.grow}
            testID="size-prompt-large"
          />
        </View>
      ) : null}

      {step === 'size' ? (
        <>
          {prompt.availableSizes.length > 0 ? (
            <View style={styles.sizes} testID="size-prompt-sizes">
              {prompt.availableSizes.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  accessibilityLabel={tr.sizePromptSizeOption(option)}
                  selected={size === option}
                  onPress={() => {
                    setSize(option);
                    setSizeError(null);
                  }}
                  testID={`size-prompt-size-${option}`}
                />
              ))}
            </View>
          ) : (
            <TextField
              label={tr.sizePromptSizeField}
              value={size}
              onChangeText={(text) => {
                setSize(text);
                setSizeError(null);
              }}
              placeholder={tr.sizePromptSizePlaceholder}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={MAX_SIZE_LENGTH}
              returnKeyType="done"
              onSubmitEditing={saveFit}
              testID="size-prompt-size-field"
            />
          )}
          {sizeError ? (
            <Text
              style={styles.error}
              accessibilityLiveRegion="polite"
              testID="size-prompt-size-error"
            >
              {sizeError}
            </Text>
          ) : null}
          <Button
            label={tr.sizePromptSizeSave}
            onPress={saveFit}
            loading={busy}
            testID="size-prompt-size-save"
          />
          <Button
            label={tr.sizePromptSizeBack}
            variant="quiet"
            disabled={busy}
            onPress={() => {
              setStep('how');
              setSizeError(null);
              answer.reset();
            }}
            testID="size-prompt-size-back"
          />
        </>
      ) : null}

      {failed ? (
        <View style={styles.failure} accessibilityLiveRegion="polite" testID="size-prompt-error">
          <Icon name="info" size={16} color={theme.colors.danger} />
          <Text style={styles.error}>{failed}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** One answer: outlined, at least 44 high, and its words wrap instead of being cut when the text is enlarged. */
function Choice({
  label,
  onPress,
  disabled,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  style?: StyleProp<ViewStyle>;
  testID: string;
}): ReactNode {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, style, disabled && styles.choiceDisabled]}
      testID={testID}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Collapsed: 2 × 1 (border) + 2 × `sm` + 20 (title line) + `xs` + 44 (answers) = 86 at the default text size.
  card: {
    marginHorizontal: theme.screenPaddingX,
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.tile,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bg,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  thumb: {
    width: theme.sizes.sizePromptThumb,
    height: theme.sizes.sizePromptThumb,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  text: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleRowWrap: {
    flexWrap: 'wrap',
  },
  name: {
    ...theme.typography.label,
    color: theme.colors.ink,
    flexShrink: 1,
  },
  ask: {
    ...theme.typography.label,
    color: theme.colors.ink,
    flexShrink: 0,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  question: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  choice: {
    minHeight: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    backgroundColor: theme.colors.bg,
  },
  grow: {
    flexGrow: 1,
  },
  choiceDisabled: {
    opacity: 0.4,
  },
  choiceText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  // "Bu ürün için sorma": a small ✕ in the corner, a full 44 pt target.
  close: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginRight: -theme.spacing.sm,
    marginTop: -theme.spacing.sm,
  },
  sizes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  failure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    flexShrink: 1,
  },
  confirmation: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  confirmationText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    flex: 1,
  },
});
