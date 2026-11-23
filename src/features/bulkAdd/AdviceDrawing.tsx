import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

/** The drawing's own coordinate box; it scales to the width it is given. */
const WIDTH = 320;
const HEIGHT = 168;
const STROKE = 1.5;

/**
 * The advice in one picture: three garments laid flat and apart on a surface, seen from above. The one chalk mark is
 * the span between two of them, Kombin pointing at the gap the first advice line asks for. Static: nothing moves.
 */
export function AdviceDrawing() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={tr.bulkDrawingLabel}
      style={styles.panel}
      testID="bulk-drawing"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {/* T-shirt */}
        <Path
          d="M60 34 L74 28 Q82 37 90 28 L104 34 L122 50 L110 62 L102 55 L102 136 L62 136 L62 55 L54 62 L42 50 Z"
          fill={theme.colors.bg}
          stroke={theme.colors.ink2}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
        {/* Trousers */}
        <Path
          d="M186 28 L246 28 L252 140 L228 140 L216 66 L204 140 L180 140 Z"
          fill={theme.colors.bg}
          stroke={theme.colors.ink2}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
        <Line x1={186} y1={38} x2={246} y2={38} stroke={theme.colors.ink2} strokeWidth={STROKE} />
        {/* Sock */}
        <Path
          d="M276 92 L290 92 L290 124 L304 132 L300 144 L280 136 Q273 131 276 122 Z"
          fill={theme.colors.bg}
          stroke={theme.colors.ink2}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
        {/* The gap: a chalk span with end ticks */}
        <Line
          x1={134}
          y1={86}
          x2={170}
          y2={86}
          stroke={theme.colors.chalkLine}
          strokeWidth={STROKE}
          strokeDasharray="4 4"
        />
        <Line
          x1={134}
          y1={79}
          x2={134}
          y2={93}
          stroke={theme.colors.chalkLine}
          strokeWidth={STROKE}
        />
        <Line
          x1={170}
          y1={79}
          x2={170}
          y2={93}
          stroke={theme.colors.chalkLine}
          strokeWidth={STROKE}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    aspectRatio: WIDTH / HEIGHT,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
});
