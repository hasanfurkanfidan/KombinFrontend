import Svg, { Path } from 'react-native-svg';

import { theme } from '@/theme';

const PATHS = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  wardrobe: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M12 4v16'],
  plus: ['M12 5v14', 'M5 12h14'],
  tag: ['M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z', 'M7.5 7.5h.01'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  arrowUpRight: ['M7 17 17 7', 'M7 7h10v10'],
  bookmark: ['M6 3h12v18l-6-4-6 4z'],
  bell: ['M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  shirt: [
    'M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  check: ['M20 6 9 17l-5-5'],
  heart: [
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  ],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  chevronRight: ['M9 6l6 6-6 6'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  minus: ['M5 12h14'],
  more: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  sliders: [
    'M4 21v-7',
    'M4 10V3',
    'M12 21v-9',
    'M12 8V3',
    'M20 21v-5',
    'M20 12V3',
    'M1 14h6',
    'M9 8h6',
    'M17 16h6',
  ],
  trendDown: ['M22 17l-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
  box: [
    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    'M3.27 6.96 12 12.01l8.73-5.05',
    'M12 22.08V12',
  ],
  camera: [
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
    'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  shuffle: ['M16 3h5v5', 'M4 20 21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Fills the shape with `color` (selected bookmark, active bell). */
  filled?: boolean;
}

export function Icon({
  name,
  size = 24,
  color = theme.colors.ink,
  strokeWidth = 1.8,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      {PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
