import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { signOut, useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatMonthYear } from '@/utils/dates';

import { useMe } from './hooks';

export function ProfileScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const me = useMe();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

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
        <View style={styles.card}>
          {me.data ? (
            <View style={styles.identity}>
              <Text style={styles.name}>{me.data.displayName}</Text>
              <Text style={styles.body}>{me.data.email}</Text>
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
          <Button
            label={tr.profileLogout}
            variant="secondary"
            onPress={() => void handleSignOut()}
            loading={signingOut}
            testID="profile-sign-out"
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.xxl,
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
  identity: {
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
});
