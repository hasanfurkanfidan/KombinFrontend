import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { theme } from '@/theme';

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
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.borderStrong}
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
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
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
    ...theme.typography.captionMedium,
    color: theme.colors.ink2,
  },
  input: {
    ...theme.typography.body,
    height: theme.sizes.fieldHeight,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: theme.spacing.lg,
    color: theme.colors.ink,
    backgroundColor: theme.colors.bg,
  },
  inputFocused: {
    borderColor: theme.colors.ink,
  },
  inputError: {
    borderColor: theme.colors.danger,
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
