import { StyleSheet, Switch, Text, View } from 'react-native';

import { theme } from '@/theme';

interface ToggleRowProps {
  title: string;
  caption?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

/** A title (and optional caption) with a green switch; the title is the switch's spoken name. */
export function ToggleRow({ title, caption, value, onChange, testID }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.control, true: theme.colors.primary }}
        thumbColor={theme.colors.bg}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});
