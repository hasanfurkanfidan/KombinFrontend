import { useEffect } from 'react';
import { Text, type TextProps } from 'react-native';

import { announce } from '@/utils/a11y';

/**
 * A message that appears while the user is looking elsewhere (a form error, a failed save, a result): Android says it
 * through the live region, iOS (which has none) through an announcement. Use it for anything that shows up without a tap.
 */
export function LiveText({ children, ...props }: TextProps) {
  const spoken =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.filter((part) => typeof part === 'string' || typeof part === 'number').join('')
        : '';

  useEffect(() => {
    announce(spoken, 'ios');
  }, [spoken]);

  return (
    <Text accessibilityLiveRegion="polite" {...props}>
      {children}
    </Text>
  );
}
