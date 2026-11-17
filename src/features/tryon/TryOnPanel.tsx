import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import type { TryOnSubject } from '@/api/endpoints/tryon';
import { AppImage } from '@/components/AppImage';
import { LiveText } from '@/components/LiveText';
import { Shimmer } from '@/components/Shimmer';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { lines } from '@/utils/a11y';

import { markReported, wasReported } from './gate';
import { buildReport, useReportTryOn, type TryOnState } from './hooks';
import { fitRows, spokenTryOn, type PieceNames } from './labels';
import { QuietLink } from './QuietLink';

export interface TryOnPanelProps {
  subject: TryOnSubject;
  state: TryOnState;
  /** Names of the pieces on screen by the id the answer uses (an outfit's pieces; the product itself for a product). */
  names: PieceNames;
  /** Set for a product: the picture is described as that product with the user's wardrobe pieces. */
  productName?: string;
  /** Called before the panel sends the user to another screen (the measurements), so a sheet around it can close. */
  onLeave?: () => void;
}

/**
 * The mannequin picture and what goes with it. `preparing`: a surface panel the size of the figure with "Hazırlanıyor".
 * `ready`: the image on a white panel, the honest label under it, the fit of each piece, the line about measurements the
 * mannequin had to guess, and the one-tap "Yanlış görünüyor". No sharing here.
 *
 * The image link is private and lasts an hour: it goes to the image component and nowhere else.
 */
export function TryOnPanel({ subject, state, names, productName, onLeave }: TryOnPanelProps) {
  const window = useWindowDimensions();
  const width = window.width - theme.screenPaddingX * 2;
  const height = Math.round(
    Math.min(width * theme.sizes.tryOnRatio, window.height * theme.sizes.tryOnMaxHeightRatio),
  );
  const { answer, phase } = state;

  if (!answer || phase === 'hidden') {
    return null;
  }

  if (phase === 'preparing') {
    return (
      <View style={[styles.panel, styles.preparing, { height }]} testID="tryon-preparing">
        <Shimmer />
        <LiveText style={styles.preparingText}>{tr.tryOnPreparing}</LiveText>
      </View>
    );
  }

  const rows = fitRows(answer, names);
  return (
    <View style={styles.root} testID="tryon-panel">
      <View style={[styles.panel, styles.ready, { height }]}>
        {answer.imageUrl ? (
          <AppImage
            uri={answer.imageUrl}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={spokenTryOn(names, productName ?? null)}
            testID="tryon-image"
          />
        ) : null}
      </View>
      <Text style={styles.caption} testID="tryon-caption">
        {tr.tryOnCaption}
      </Text>

      {rows.length > 0 ? (
        <View style={styles.rows} testID="tryon-fit">
          {rows.map((row) => (
            <View key={row.id} style={styles.row} testID={`tryon-fit-${row.id}`}>
              <View style={styles.leaderLine} />
              <Text style={styles.name} numberOfLines={lines(2)}>
                {row.name}
              </Text>
              {row.notable ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{row.label}</Text>
                </View>
              ) : (
                <Text style={styles.plain}>{row.label}</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {answer.defaultedMeasurements.length > 0 ? <MeasurementsLine onLeave={onLeave} /> : null}

      <ReportAction subject={subject} state={state} />
    </View>
  );
}

function MeasurementsLine({ onLeave }: { onLeave?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.measurements} testID="tryon-measurements">
      <Text style={styles.measurementsText}>{tr.tryOnMeasurements}</Text>
      <QuietLink
        label={tr.tryOnMeasurementsAction}
        onPress={() => {
          onLeave?.();
          router.push('/profile/sizes');
        }}
        testID="tryon-measurements-action"
      />
    </View>
  );
}

/**
 * "Yanlış görünüyor": one tap sends the report, then "Teşekkürler" takes its place. It is sent once per drawing (the
 * subject is remembered for the session; the backend also stores a repeated report once).
 */
function ReportAction({ subject, state }: { subject: TryOnSubject; state: TryOnState }) {
  const key = `${subject.kind}:${subject.id}`;
  const report = useReportTryOn();
  const [sent, setSent] = useState(() => wasReported(key));
  const { answer } = state;

  if (sent) {
    return (
      <LiveText style={styles.thanks} testID="tryon-thanks">
        {tr.tryOnReportThanks}
      </LiveText>
    );
  }
  return (
    <QuietLink
      label={tr.tryOnReport}
      disabled={report.isPending}
      onPress={() => {
        if (!answer || report.isPending) {
          return;
        }
        report.mutate(buildReport(subject, answer), {
          onSuccess: () => {
            markReported(key);
            setSent(true);
          },
          onError: () => showToast(tr.outfitActionFailed),
        });
      }}
      style={styles.report}
      testID="tryon-report"
    />
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.spacing.md,
  },
  panel: {
    width: '100%',
    borderRadius: theme.radius.panel,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The figure's own panel while it is drawn: a surface, a shimmer and one word.
  preparing: {
    backgroundColor: theme.colors.surface,
  },
  preparingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink2,
  },
  // White with a hairline: the picture is the only surface, no shadow.
  ready: {
    backgroundColor: theme.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  rows: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  leaderLine: {
    width: theme.sizes.leaderLine,
    height: 1,
    backgroundColor: theme.colors.control,
  },
  name: {
    ...theme.typography.body,
    color: theme.colors.ink,
    flex: 1,
  },
  tag: {
    backgroundColor: theme.colors.chalk,
    borderRadius: theme.radius.tag,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    ...theme.typography.captionStrong,
    color: theme.colors.chalkInk,
  },
  plain: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink,
  },
  measurements: {
    gap: theme.spacing.xs,
  },
  measurementsText: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  report: {
    alignSelf: 'flex-start',
  },
  thanks: {
    ...theme.typography.bodyMedium,
    color: theme.colors.muted,
    minHeight: theme.sizes.touch,
    textAlignVertical: 'center',
  },
});
