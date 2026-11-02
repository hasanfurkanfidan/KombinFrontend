import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

/** A soft light band sweeping across its parent (which clips it): "something is being prepared here". */
export function Shimmer() {
  const [progress] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const band = width / 2;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      testID="shimmer"
    >
      <Animated.View
        style={[
          styles.band,
          {
            width: band,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-band, width],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    height: '100%',
    backgroundColor: theme.colors.surface,
    opacity: 0.55,
  },
});
