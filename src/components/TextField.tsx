import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { theme } from '@/theme';

import { LiveText } from './LiveText';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({
  label,
  error,
  hint,
  onFocus,
  onBlur,
  style,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {/* The input carries the label (and the error or hint as its hint): read once, not twice. */}
      <Text
        style={styles.label}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={theme.colors.muted}
        {...inputProps}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? (
        <LiveText style={styles.error}>{error}</LiveText>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink2,
  },
  input: {
    ...theme.typography.body,
    height: theme.sizes.fieldHeight,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    paddingHorizontal: theme.spacing.lg,
    color: theme.colors.ink,
    backgroundColor: theme.colors.bg,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    paddingHorizontal: theme.spacing.lg - 1,
  },
  inputError: {
    borderColor: theme.colors.danger,
    borderWidth: 2,
    paddingHorizontal: theme.spacing.lg - 1,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});
