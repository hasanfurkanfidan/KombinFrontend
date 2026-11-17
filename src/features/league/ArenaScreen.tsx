import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { IconButton } from '@/components/IconButton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { announce, lines } from '@/utils/a11y';

interface ArenaScreenProps {
  children: ReactNode;
  /** The body scrolls (large text, long tables); the footer stays where it is. */
  scroll?: boolean;
  /** Pinned under the body: the screen's one action. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The league's dark zone: a moss-green ground inside the white app, with light status-bar icons. The cards on it are
 * white and carry the content; the only filled action is chalk.
 */
export function ArenaScreen({ children, scroll = false, footer, contentStyle }: ArenaScreenProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="arena-screen">
      <StatusBar style="light" />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

interface ArenaHeaderProps {
  /** A close cross (the screen was opened over another) or a back arrow (a step deeper). */
  leading: 'close' | 'back';
  onLeading: () => void;
  /** Under "Kombin Ligi": the tier and the place, or what the screen is about. */
  subtitle?: string | null;
  trailing?: ReactNode;
}

/** The header every league screen shares: the button, "Kombin Ligi" in chalk with a line under it, and a trailing slot. */
export function ArenaHeader({ leading, onLeading, subtitle, trailing }: ArenaHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <IconButton
          icon={leading === 'close' ? 'close' : 'arrowLeft'}
          label={leading === 'close' ? tr.close : tr.back}
          tone="arena"
          onPress={onLeading}
          testID="arena-leading"
        />
      </View>
      <View style={styles.center}>
        <Text style={styles.brand} numberOfLines={lines(1)}>
          {tr.leagueTitle}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={lines(1)} testID="arena-subtitle">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
    </View>
  );
}

interface ArenaMessageProps {
  title: string;
  body?: string;
  /** The buttons under the message; the first one is the screen's chalk action. */
  actions?: ReactNode;
}

/** An empty or failed state on the dark ground: what happened, what to do next, announced once. */
export function ArenaMessage({ title, body, actions }: ArenaMessageProps) {
  useEffect(() => {
    announce(body ? `${title}. ${body}` : title);
  }, [title, body]);
  return (
    <View style={styles.message} testID="arena-message">
      <Text accessibilityRole="header" style={styles.messageTitle}>
        {title}
      </Text>
      {body ? <Text style={styles.messageBody}>{body}</Text> : null}
      {actions ? <View style={styles.messageActions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.arena.ground,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  side: {
    minWidth: theme.sizes.touch,
  },
  trailing: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  brand: {
    ...theme.typography.captionStrong,
    color: theme.colors.chalk,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.arena.textSoft,
    textAlign: 'center',
  },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xxl,
  },
  messageTitle: {
    ...theme.typography.title,
    color: theme.arena.text,
    textAlign: 'center',
  },
  messageBody: {
    ...theme.typography.body,
    color: theme.arena.textSoft,
    textAlign: 'center',
  },
  messageActions: {
    alignSelf: 'stretch',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
  },
});
