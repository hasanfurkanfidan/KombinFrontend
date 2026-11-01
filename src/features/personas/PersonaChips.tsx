import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { MAX_PERSONAS, useActivatePersona, usePersonas } from './hooks';

/**
 * The persona chips under the greeting (design screen 02) plus the dashed "+" chip. Picking a chip makes that persona
 * active, which re-scores the product list. Hidden while logged out or before the first persona exists.
 */
export function PersonaChips() {
  const router = useRouter();
  const personas = usePersonas().data;
  const activate = useActivatePersona();

  if (!personas || personas.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      testID="persona-chips"
    >
      {personas.map((persona) => (
        <Chip
          key={persona.id}
          label={persona.name}
          selected={persona.isActive}
          onPress={() => {
            if (!persona.isActive) {
              activate.mutate(persona.id);
            }
          }}
          testID={`persona-chip-${persona.id}`}
        />
      ))}
      {personas.length < MAX_PERSONAS ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.personaAdd}
          onPress={() => router.push({ pathname: '/persona', params: { flow: 'new' } })}
          style={styles.add}
          testID="persona-add"
        >
          <Icon name="plus" size={18} color={theme.colors.inkMuted} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: theme.screenPaddingX,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  add: {
    width: theme.sizes.chipHeight,
    height: theme.sizes.chipHeight,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
