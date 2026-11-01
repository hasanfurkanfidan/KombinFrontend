import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme';
import { formatShortDate } from '@/utils/dates';
import { formatTry } from '@/utils/money';

import { buildChartGeometry, type ChartPoint } from './priceHistory';

interface PriceHistoryChartProps {
  points: readonly ChartPoint[];
  /** `mini` is the 120x34 sparkline of the detail card, `full` the expanded 200px chart. */
  variant?: 'mini' | 'full';
  /** The 90-day low, drawn as a dashed line. Defaults to the lowest plotted point. */
  lowPrice?: number;
}

const MINI = {
  width: theme.sizes.chartMiniWidth,
  height: theme.sizes.chartMiniHeight,
  paddingX: 2,
  paddingTop: 4,
  paddingBottom: 4,
};

const FULL_PADDING = { paddingX: 16, paddingTop: 28, paddingBottom: 32 };

export function PriceHistoryChart({ points, variant = 'mini', lowPrice }: PriceHistoryChartProps) {
  const [fullWidth, setFullWidth] = useState(0);

  if (points.length === 0) {
    return null;
  }

  if (variant === 'mini') {
    const geometry = buildChartGeometry(points, MINI, lowPrice);
    return (
      <Svg
        width="100%"
        height={MINI.height}
        viewBox={`0 0 ${MINI.width} ${MINI.height}`}
        preserveAspectRatio="xMinYMid meet"
        testID="price-chart-mini"
      >
        <Path d={geometry.path} stroke={theme.colors.ink} strokeWidth={1.5} fill="none" />
        {geometry.last ? (
          <Circle cx={geometry.last.x} cy={geometry.last.y} r={3} fill={theme.colors.accent} />
        ) : null}
      </Svg>
    );
  }

  const height = theme.sizes.chartFullHeight;
  const onLayout = (event: LayoutChangeEvent) => setFullWidth(event.nativeEvent.layout.width);
  const geometry =
    fullWidth > 0
      ? buildChartGeometry(points, { width: fullWidth, height, ...FULL_PADDING }, lowPrice)
      : null;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return (
    <View onLayout={onLayout} style={styles.full} testID="price-chart-full">
      {geometry && firstPoint && lastPoint ? (
        <Svg width={fullWidth} height={height} viewBox={`0 0 ${fullWidth} ${height}`}>
          {geometry.lowY !== null ? (
            <Line
              x1={FULL_PADDING.paddingX}
              x2={fullWidth - FULL_PADDING.paddingX}
              y1={geometry.lowY}
              y2={geometry.lowY}
              stroke={theme.colors.borderStrong}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}
          <Path d={geometry.path} stroke={theme.colors.ink} strokeWidth={2} fill="none" />
          {geometry.last ? (
            <Circle cx={geometry.last.x} cy={geometry.last.y} r={5} fill={theme.colors.accent} />
          ) : null}
          <SvgText
            x={FULL_PADDING.paddingX}
            y={16}
            fontSize={11}
            fontFamily={theme.fontFamilies.bodyMedium}
            fill={theme.colors.inkMuted}
          >
            {formatTry(geometry.maxPrice)}
          </SvgText>
          <SvgText
            x={FULL_PADDING.paddingX}
            y={height - 10}
            fontSize={11}
            fontFamily={theme.fontFamilies.body}
            fill={theme.colors.inkMuted}
          >
            {formatShortDate(firstPoint.date)}
          </SvgText>
          <SvgText
            x={fullWidth - FULL_PADDING.paddingX}
            y={height - 10}
            fontSize={11}
            fontFamily={theme.fontFamilies.body}
            fill={theme.colors.inkMuted}
            textAnchor="end"
          >
            {formatShortDate(lastPoint.date)}
          </SvgText>
          {geometry.lowY !== null ? (
            <SvgText
              x={fullWidth - FULL_PADDING.paddingX}
              y={geometry.lowY - 6}
              fontSize={11}
              fontFamily={theme.fontFamilies.bodyStrong}
              fill={theme.colors.inkMuted}
              textAnchor="end"
            >
              {formatTry(geometry.minPrice)}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    width: '100%',
    height: theme.sizes.chartFullHeight,
  },
});
