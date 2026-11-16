import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

import { isGone, useAnswerSizePrompt, useFirstSizePrompt } from './hooks';
import { initialSize } from './labels';

const MAX_SIZE_LENGTH = 20;

/**
 * Keşfet's "did the size fit?" card: the first open question about a product the user went to buy, above the daily
 * outfit. Quiet by design (a hairline card, no push, no modal) and absent, with no room reserved, when there is no
 * question, the user turned them off, or nobody is signed in.
 */
export function SizePromptCard() {
  const prompt = useFirstSizePrompt();
  // Keyed by question: the next one starts on its first step with its own size.
  return prompt ? <PromptCard key={prompt.id} prompt={prompt} /> : null;
}

type Step = 'ask' | 'size';

/** The sentence under the card when saving failed (the existing error lines: rate limit, offline, generic). */
function failureText(error: unknown): string {
  if (error instanceof ApiError && error.isNetworkError) {
    return tr.errorNetwork;
  }
  return rateLimitedText(error) ?? tr.errorBody;
}

function PromptCard({ prompt }: { prompt: SizePrompt }) {
  const [step, setStep] = useState<Step>('ask');
  const [size, setSize] = useState(() => initialSize(prompt));
  const [sizeError, setSizeError] = useState<string | null>(null);
  const answer = useAnswerSizePrompt();

  // Once per question shown (the card is keyed by the question).
  useEffect(() => {
    track('size_prompt_view', { promptId: prompt.id });
  }, [prompt.id]);

  const busy = answer.isPending;
  const failed = answer.isError && !isGone(answer.error) ? failureText(answer.error) : null;
  const brand = prompt.brand.name;

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

  return (
    <View style={styles.card} testID="size-prompt-card">
      <View style={styles.product}>
        <View style={styles.thumb}>
          {prompt.product.imageUrl ? (
            <AppImage uri={prompt.product.imageUrl} style={styles.fill} contentFit="contain" />
          ) : (
            <Icon name="shirt" size={24} color={theme.colors.control} strokeWidth={1.4} />
          )}
        </View>
        <View style={styles.productText}>
          <Text style={styles.productName} numberOfLines={2} testID="size-prompt-product">
            {prompt.product.name}
          </Text>
          <Text style={styles.caption} numberOfLines={1} testID="size-prompt-brand">
            {tr.sizePromptBrandSeller(brand, prompt.seller.name)}
          </Text>
        </View>
      </View>

      {step === 'ask' ? (
        <>
          <Text style={styles.question} accessibilityRole="header">
            {tr.sizePromptQuestion}
          </Text>
          <View style={styles.answers}>
            <Choice
              label={tr.sizePromptFits}
              disabled={busy}
              onPress={() => setStep('size')}
              testID="size-prompt-fits"
            />
            <Choice
              label={tr.sizePromptTooSmall}
              disabled={busy}
              onPress={() => send('BoughtTooSmall', null)}
              testID="size-prompt-small"
            />
            <Choice
              label={tr.sizePromptTooLarge}
              disabled={busy}
              onPress={() => send('BoughtTooLarge', null)}
              testID="size-prompt-large"
            />
            <Choice
              label={tr.sizePromptNotBought}
              disabled={busy}
              onPress={() => send('NotBought', null)}
              testID="size-prompt-not-bought"
            />
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => send('NeverAsk', null)}
            style={styles.never}
            testID="size-prompt-never"
          >
            <Text style={styles.neverText}>{tr.sizePromptNever}</Text>
          </PressableScale>
        </>
      ) : (
        <>
          <Text style={styles.question} accessibilityRole="header">
            {tr.sizePromptSizeTitle(brand)}
          </Text>
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
              setStep('ask');
              setSizeError(null);
              answer.reset();
            }}
            testID="size-prompt-size-back"
          />
        </>
      )}

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
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  testID: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, disabled && styles.choiceDisabled]}
      testID={testID}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: theme.screenPaddingX,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.tile,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bg,
  },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  thumb: {
    width: theme.sizes.tagThumb,
    height: theme.sizes.tagThumb,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  productText: {
    flex: 1,
    gap: 2,
  },
  productName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  question: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  answers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  // Two to a row at normal size; a longer label (or larger text) takes the whole row instead of being cut.
  choice: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    backgroundColor: theme.colors.bg,
  },
  choiceDisabled: {
    opacity: 0.4,
  },
  choiceText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  never: {
    minHeight: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neverText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.muted,
    textAlign: 'center',
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
});
