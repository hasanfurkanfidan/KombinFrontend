import { useEffect, useState } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { announce } from '@/utils/a11y';

interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height,
  radius = theme.radius.control,
  style,
}: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.55));
  // Reduced motion: a still placeholder instead of a pulsing one.
  const reduceMotion = useReducedMotion();

  // A skeleton is silent for a screen reader: say once that something is loading (several mount together).
  useEffect(() => {
    announce(tr.a11yLoading);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.75);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.colors.surface, opacity },
        style,
      ]}
    />
  );
}
