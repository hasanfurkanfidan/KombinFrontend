import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tabs } from 'expo-router';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { Icon, type IconName } from './Icon';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ITEMS: Record<string, { label: string; icon: IconName }> = {
  index: { label: tr.tabDiscover, icon: 'home' },
  wardrobe: { label: tr.tabWardrobe, icon: 'wardrobe' },
  add: { label: tr.tabAdd, icon: 'plus' },
  tracking: { label: tr.tabTracking, icon: 'tag' },
  profile: { label: tr.tabProfile, icon: 'user' },
};

/** Bottom bar with a raised round "+" in the middle (design screens 02, 04, 05). */
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
        const item = ITEMS[route.name];
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

        if (route.name === 'add') {
          return (
            <View key={route.key} style={styles.slot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={onPress}
                style={[styles.addButton, theme.shadows.raised]}
                testID="tab-add"
              >
                <Icon name="plus" size={26} color={theme.colors.onInk} />
              </Pressable>
            </View>
          );
        }

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
  addButton: {
    // Lifts the button above the bar's top edge, as in the design.
    marginTop: -theme.spacing.xxl,
    width: theme.sizes.tabAddButton,
    height: theme.sizes.tabAddButton,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
