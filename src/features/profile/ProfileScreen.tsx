import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Persona } from '@/api/models';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { MAX_PERSONAS, usePersonas } from '@/features/personas/hooks';
import { personaCaption } from '@/features/personas/caption';
import { PersonaSheet } from '@/features/personas/PersonaSheet';
import { swatchColor } from '@/features/personas/swatches';
import { PreferencesSheet } from '@/features/notifications/PreferencesSheet';
import { useSavedIds } from '@/features/saved/hooks';
import { useSizes } from '@/features/sizes/hooks';
import { tr } from '@/i18n/tr';
import { signOut, useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatMonthYear } from '@/utils/dates';
import { toNumber } from '@/utils/money';

import { useMe, useProfile } from './hooks';

const SWATCHES_PER_PERSONA = 4;

export function ProfileScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const me = useMe();
  const profile = useProfile();
  const personas = usePersonas();
  const savedIds = useSavedIds();
  const sizes = useSizes();
  const [signingOut, setSigningOut] = useState(false);
  const [sheetPersona, setSheetPersona] = useState<Persona | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const personaCount = profile.data ? toNumber(profile.data.personaCount) : personas.data?.length;
  const brandCount = new Set(sizes.data?.map((entry) => entry.brand.id)).size;

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={styles.title}>{tr.profileTitle}</Text>

      {!isSignedIn ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr.profileLoggedOutTitle}</Text>
          <Text style={styles.body}>{tr.profileLoggedOutBody}</Text>
          <Button
            label={tr.profileSignIn}
            onPress={() => router.push('/login')}
            testID="profile-sign-in"
          />
        </View>
      ) : me.isError ? (
        <ErrorState body={tr.profileLoadFailed} onRetry={() => void me.refetch()} />
      ) : (
        <>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {me.data?.displayName.charAt(0).toLocaleUpperCase('tr-TR') ?? ''}
              </Text>
            </View>
            {me.data ? (
              <View style={styles.identity}>
                <Text style={styles.name}>{me.data.displayName}</Text>
                <Text style={styles.body} testID="profile-summary">
                  {tr.profileSummary(personaCount ?? 0, savedIds.data?.size ?? 0)}
                </Text>
                <Text style={styles.caption}>{me.data.email}</Text>
                <Text style={styles.caption}>
                  {tr.profileMemberSince(formatMonthYear(me.data.createdAt))}
                </Text>
              </View>
            ) : (
              <View style={styles.identity}>
                <Skeleton height={24} width="50%" radius={theme.radius.sm} />
                <Skeleton height={16} width="70%" radius={theme.radius.sm} />
                <Skeleton height={14} width="40%" radius={theme.radius.sm} />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{tr.profilePersonas}</Text>
            {(personas.data ?? []).map((persona) => (
              <PersonaRow
                key={persona.id}
                persona={persona}
                onPress={() => setSheetPersona(persona)}
              />
            ))}
            {personas.data && personas.data.length < MAX_PERSONAS ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/persona',
                    params: { flow: 'new', returnTo: '/profile' },
                  })
                }
                style={styles.newPersona}
                testID="profile-new-persona"
              >
                <Icon name="plus" size={18} color={theme.colors.inkMuted} />
                <Text style={styles.newPersonaText}>{tr.profileNewPersona}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.rows}>
            <SettingsRow
              title={tr.profileSizeMap}
              caption={tr.profileSizeMapCount(brandCount)}
              onPress={() => router.push('/profile/sizes')}
              testID="profile-size-map"
            />
            <SettingsRow
              title={tr.profileSavedOutfits}
              caption={tr.profileSavedOutfitsCaption}
              onPress={() => router.push('/outfits/saved')}
              divider
              testID="profile-saved-outfits"
            />
            <SettingsRow
              title={tr.profileNotifications}
              caption={tr.profileNotificationsCaption}
              onPress={() => setPreferencesOpen(true)}
              divider
              testID="profile-notifications"
            />
            <SettingsRow title={tr.profileStores} caption={tr.comingSoon} divider />
          </View>

          <Button
            label={tr.profileLogout}
            variant="secondary"
            onPress={() => void handleSignOut()}
            loading={signingOut}
            testID="profile-sign-out"
          />
        </>
      )}

      <PersonaSheet persona={sheetPersona} onClose={() => setSheetPersona(null)} />
      <PreferencesSheet visible={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
    </Screen>
  );
}

function PersonaRow({ persona, onPress }: { persona: Persona; onPress: () => void }) {
  const colors = persona.styleSummary.topColors.slice(0, SWATCHES_PER_PERSONA);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.personaRow}
      testID={`persona-row-${persona.id}`}
    >
      <View style={styles.swatches}>
        {Array.from({ length: SWATCHES_PER_PERSONA }, (_, position) => {
          const name = colors[position];
          return (
            <View
              key={position}
              style={[
                styles.swatch,
                { backgroundColor: name ? swatchColor(name) : theme.colors.surfaceAlt2 },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.personaText}>
        <Text style={styles.personaName}>{persona.name}</Text>
        <Text style={styles.caption} numberOfLines={2}>
          {personaCaption(persona)}
        </Text>
      </View>
      {persona.isActive ? (
        <View style={styles.activePill}>
          <Text style={styles.activeText}>{tr.personaActive}</Text>
        </View>
      ) : (
        <Icon name="chevronRight" size={18} color={theme.colors.inkMuted} />
      )}
    </Pressable>
  );
}

function SettingsRow({
  title,
  caption,
  onPress,
  divider = false,
  testID,
}: {
  title: string;
  caption: string;
  onPress?: () => void;
  divider?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.settingsRow, divider && styles.settingsDivider]}
      testID={testID}
    >
      <View style={styles.personaText}>
        <Text style={styles.personaName}>{title}</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
      {onPress ? <Icon name="chevronRight" size={18} color={theme.colors.inkMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.xl,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  card: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  cardTitle: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  avatar: {
    width: theme.sizes.avatar,
    height: theme.sizes.avatar,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...theme.typography.headingLarge,
    color: theme.colors.onInk,
  },
  identity: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  name: {
    ...theme.typography.headingLarge,
    color: theme.colors.ink,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  personaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceAlt,
  },
  swatches: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  swatch: {
    width: theme.sizes.personaSwatchWidth,
    height: theme.sizes.personaSwatchHeight,
    borderRadius: theme.radius.sm / 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  personaText: {
    flex: 1,
    gap: 2,
  },
  personaName: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  activePill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
  },
  activeText: {
    ...theme.typography.captionMedium,
    color: theme.colors.accent,
  },
  newPersona: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
  },
  newPersonaText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.inkSoft,
  },
  rows: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  settingsRow: {
    minHeight: theme.sizes.touch + theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  settingsDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
