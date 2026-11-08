import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { MAX_PERSONAS, useActivatePersona, usePersonas } from './hooks';

/**
 * One control on Keşfet, "Tarzım: Ofis ▾", instead of a row of persona chips. It opens a sheet to switch the active
 * style (which re-scores the list) or to start a new one. Hidden while logged out and whenever there is only one style
 * to choose from: then there is nothing to switch, and new styles are made on Profil.
 */
export function StyleSwitcher() {
  const router = useRouter();
  const personas = usePersonas().data;
  const activate = useActivatePersona();
  const [open, setOpen] = useState(false);

  if (!personas || personas.length < 2) {
    return null;
  }
  const active = personas.find((persona) => persona.isActive) ?? personas[0];

  return (
    <View style={styles.row}>
      <Chip
        label={styleLabel(active?.name ?? '')}
        dropdown
        onPress={() => setOpen(true)}
        testID="style-switcher"
      />
      <BottomSheet visible={open} title={tr.styleSheetTitle} onClose={() => setOpen(false)}>
        {personas.map((persona) => (
          <Pressable
            key={persona.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: persona.isActive }}
            onPress={() => {
              if (!persona.isActive) {
                activate.mutate(persona.id);
              }
              setOpen(false);
            }}
            style={styles.option}
            testID={`style-option-${persona.id}`}
          >
            <Text style={[styles.optionText, persona.isActive && styles.optionTextActive]}>
              {persona.name}
            </Text>
            {persona.isActive ? <Icon name="check" size={20} /> : null}
          </Pressable>
        ))}
        {personas.length < MAX_PERSONAS ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setOpen(false);
              router.push({ pathname: '/persona', params: { flow: 'new' } });
            }}
            style={styles.option}
            testID="style-add"
          >
            <Text style={styles.optionText}>{tr.styleSheetNew}</Text>
            <Icon name="plus" size={20} color={theme.colors.inkMuted} />
          </Pressable>
        ) : null}
      </BottomSheet>
    </View>
  );
}

/** "Tarzım: Ofis"; a style still called "Tarzım" (the one onboarding made) is not named twice. */
export function styleLabel(name: string): string {
  return name === tr.personaDefaultName ? name : tr.styleControl(name);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: theme.screenPaddingX,
  },
  option: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  optionTextActive: {
    fontFamily: theme.fontFamilies.bodyStrong,
  },
});
