import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tabs } from 'expo-router';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { Icon, type IconName } from './Icon';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * The five tabs, in bar order. Routes of the tabs group that are not listed here (the redirects kept for old links,
 * `add` and `tracking`) get no button.
 */
export const TAB_ITEMS: Record<string, { label: string; icon: IconName }> = {
  index: { label: tr.tabDiscover, icon: 'home' },
  feed: { label: tr.tabFeed, icon: 'feed' },
  wardrobe: { label: tr.tabWardrobe, icon: 'wardrobe' },
  prices: { label: tr.tabPrices, icon: 'tag' },
  profile: { label: tr.tabProfile, icon: 'user' },
};

/** Bottom bar: five labelled tabs, no floating button (every tab's main action sits in its own header). */
export function TabBar({ state, emitter, navigateToTab, insets }: TabBarProps) {
  return (
    <View
      style={[
        styles.bar,
        {
          height: theme.sizes.tabBarHeight,
          paddingBottom: Math.max(insets.bottom, theme.spacing.md),
        },
      ]}
    >
      {state.routes.map((route, position) => {
        const item = TAB_ITEMS[route.name];
        if (!item) {
          return null;
        }
        const focused = state.index === position;
        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        const color = focused ? theme.colors.ink : theme.colors.inkMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.label}
            onPress={onPress}
            style={styles.slot}
            testID={`tab-${route.name}`}
          >
            <Icon name={item.icon} size={24} color={color} />
            <Text style={[styles.label, { color }, focused && styles.labelFocused]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.sizes.touch,
  },
  label: {
    ...theme.typography.caption,
  },
  labelFocused: {
    fontFamily: theme.fontFamilies.bodyStrong,
  },
});
