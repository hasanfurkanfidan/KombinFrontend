import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Persona } from '@/api/models';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { ToggleRow } from '@/components/ToggleRow';
import { MAX_PERSONAS, usePersonas } from '@/features/personas/hooks';
import { personaCaption } from '@/features/personas/caption';
import { openLegalPage } from '@/features/legal/legal';
import { PersonaSheet } from '@/features/personas/PersonaSheet';
import { swatchColor } from '@/features/personas/swatches';
import { PreferencesSheet } from '@/features/notifications/PreferencesSheet';
import { useSavedIds } from '@/features/saved/hooks';
import { useCreatorStats } from '@/features/social/hooks';
import { useSetSizePrompts } from '@/features/sizePrompts/hooks';
import { useSizes } from '@/features/sizes/hooks';
import { tr } from '@/i18n/tr';
import { signOut, useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatMonthYear } from '@/utils/dates';
import { toNumber } from '@/utils/money';

import { useMe, useProfile } from './hooks';
import { lines } from '@/utils/a11y';

const SWATCHES_PER_PERSONA = 4;

export function ProfileScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const me = useMe();
  const profile = useProfile();
  const personas = usePersonas();
  const setSizePrompts = useSetSizePrompts();
  const currentProfile = profile.data;
  const savedIds = useSavedIds();
  const sizes = useSizes();
  // Only a creator gets "Kazançlarım": the stats answer 403 for everyone else.
  const isCreator = useCreatorStats().isSuccess;
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
      <Text accessibilityRole="header" style={styles.title}>
        {tr.profileTitle}
      </Text>

      {!isSignedIn ? (
        <Card>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {tr.profileLoggedOutTitle}
          </Text>
          <Text style={styles.body}>{tr.profileLoggedOutBody}</Text>
          <Button
            label={tr.profileSignIn}
            onPress={() => router.push('/login')}
            testID="profile-sign-in"
          />
        </Card>
      ) : me.isError ? (
        <ErrorState
          body={tr.profileLoadFailed}
          error={me.error}
          onRetry={() => void me.refetch()}
        />
      ) : (
        <>
          <View style={styles.identityRow}>
            <Avatar name={me.data?.displayName ?? ''} size="lg" testID="profile-avatar" />
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
                <Skeleton height={24} width="50%" radius={theme.radius.tag} />
                <Skeleton height={16} width="70%" radius={theme.radius.tag} />
                <Skeleton height={14} width="40%" radius={theme.radius.tag} />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {tr.profilePersonas}
            </Text>
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
                <Icon name="plus" size={18} color={theme.colors.muted} />
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
            {currentProfile ? (
              <View style={[styles.toggleRow, styles.settingsDivider]}>
                <ToggleRow
                  title={tr.sizePromptsToggle}
                  caption={tr.sizePromptsToggleCaption}
                  value={currentProfile.sizePromptsEnabled}
                  onChange={(enabled) =>
                    setSizePrompts.mutate({ profile: currentProfile, enabled })
                  }
                  testID="profile-size-prompts"
                />
              </View>
            ) : null}
            <SettingsRow
              title={tr.profileSavedOutfits}
              caption={tr.profileSavedOutfitsCaption}
              onPress={() => router.push('/outfits/saved')}
              divider
              testID="profile-saved-outfits"
            />
            <SettingsRow
              title={tr.myPostsRow}
              caption={tr.myPostsRowCaption}
              onPress={() => router.push('/posts/mine')}
              divider
              testID="profile-my-posts"
            />
            {isCreator ? (
              <SettingsRow
                title={tr.creatorEarningsRow}
                caption={tr.creatorEarningsRowCaption}
                onPress={() => router.push('/profile/creator')}
                divider
                testID="profile-creator-stats"
              />
            ) : null}
            <SettingsRow
              title={tr.blocksRow}
              caption={tr.blocksRowCaption}
              onPress={() => router.push('/profile/blocks')}
              divider
              testID="profile-blocks"
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
        </>
      )}

      {/* The legal pages are public: they show signed out too. Logout and deletion need an account. */}
      <View style={styles.section} testID="profile-account">
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {tr.profileAccount}
        </Text>
        <View style={styles.rows}>
          <SettingsRow
            title={tr.legalPrivacy}
            onPress={() => void openLegalPage('privacy')}
            testID="profile-privacy"
          />
          <SettingsRow
            title={tr.legalTerms}
            onPress={() => void openLegalPage('terms')}
            divider
            testID="profile-terms"
          />
        </View>
        {isSignedIn ? (
          <>
            <Button
              label={tr.profileLogout}
              variant="secondary"
              onPress={() => void handleSignOut()}
              loading={signingOut}
              testID="profile-sign-out"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/profile/delete-account')}
              style={styles.deleteAccount}
              testID="profile-delete-account"
            >
              <Text style={styles.deleteAccountText}>{tr.profileDeleteAccount}</Text>
            </Pressable>
          </>
        ) : null}
      </View>

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
                { backgroundColor: name ? swatchColor(name) : theme.colors.surface },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.personaText}>
        <Text style={styles.personaName}>{persona.name}</Text>
        <Text style={styles.caption} numberOfLines={lines(2)}>
          {personaCaption(persona)}
        </Text>
      </View>
      {persona.isActive ? (
        <View style={styles.activePill}>
          <Text style={styles.activeText}>{tr.personaActive}</Text>
        </View>
      ) : (
        <Icon name="chevronRight" size={18} color={theme.colors.muted} />
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
  caption?: string;
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
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {onPress ? <Icon name="chevronRight" size={18} color={theme.colors.muted} /> : null}
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
  cardTitle: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  identity: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  name: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
  },
  personaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surface,
  },
  swatches: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  swatch: {
    width: theme.sizes.personaSwatchWidth,
    height: theme.sizes.personaSwatchHeight,
    borderRadius: theme.radius.tag / 2,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  personaText: {
    flex: 1,
    gap: 2,
  },
  personaName: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  activePill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.tag,
    backgroundColor: theme.colors.primarySoft,
  },
  activeText: {
    ...theme.typography.captionStrong,
    color: theme.colors.primary,
  },
  newPersona: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.tile,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.control,
  },
  newPersonaText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink2,
  },
  rows: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.tile,
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
  toggleRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  deleteAccount: {
    minHeight: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.danger,
  },
  settingsDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
  },
});
