import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { ExternalSignInButtons } from './ExternalSignInButtons';
import { LoginForm } from './LoginForm';

export function LoginScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <IconButton
          icon="arrowLeft"
          label={tr.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {tr.authLoginTitle}
          </Text>
          <Text style={styles.subtitle}>{tr.authLoginSubtitle}</Text>
        </View>
        {/* A new account is sent to onboarding by `OnboardingGate`, exactly like a registration. */}
        <ExternalSignInButtons
          onSuccess={() => router.dismissTo('/')}
          onPendingDeletion={() => router.push('/pending-deletion')}
        />
        <LoginForm
          onSuccess={() => router.dismissTo('/')}
          onPendingDeletion={() => router.push('/pending-deletion')}
        />
        <View style={styles.footer}>
          <Text style={styles.footerText}>{tr.authLoginToRegister}</Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={12}
            onPress={() => router.replace('/register')}
          >
            <Text style={styles.footerLink}>{tr.authLoginToRegisterAction}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.xxl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  header: {
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  footerText: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  footerLink: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
});
