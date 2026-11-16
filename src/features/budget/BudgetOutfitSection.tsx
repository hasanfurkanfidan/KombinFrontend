import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BudgetOutfit, BudgetPiece, OutfitPiece } from '@/api/models';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { NarrationRow } from '@/features/outfits/OutfitFrame';
import { OutfitPieces } from '@/features/outfits/OutfitPieces';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { toFigurePiece } from './pieces';
import { shippingNote } from './shipping';

interface BudgetOutfitSectionProps {
  outfit: BudgetOutfit;
  signedIn: boolean;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
  onDismiss: () => void;
  /** "Bütçeyi artır" on the over-budget mark: reopens the sheet. */
  onIncrease: () => void;
  /** Opens the piece's offer through its `goPath`; the section never sees a seller URL. */
  onBuy: (piece: BudgetPiece) => void;
  onAddSize: () => void;
}

function Tag({ text, chalk = false, testID }: { text: string; chalk?: boolean; testID?: string }) {
  return (
    <View style={[styles.tag, chalk && styles.tagChalk]} testID={testID}>
      <Text style={[styles.tagText, chalk && styles.tagTextChalk]}>{text}</Text>
    </View>
  );
}

/**
 * One budget outfit: its total and what is left, the standing figure with a label per piece ("Dolabında var" or the
 * price, the seller and a buy link), the narration, then save and dismiss. No card around it: the figure's own panel
 * is the only surface.
 */
export function BudgetOutfitSection({
  outfit,
  signedIn,
  saved,
  saving,
  onSave,
  onDismiss,
  onIncrease,
  onBuy,
  onAddSize,
}: BudgetOutfitSectionProps) {
  const figure = useMemo(() => outfit.pieces.map(toFigurePiece), [outfit.pieces]);
  const sources = useMemo(
    () =>
      new Map<OutfitPiece, BudgetPiece>(
        figure.map((piece, index) => [piece, outfit.pieces[index]!]),
      ),
    [figure, outfit.pieces],
  );

  const over = outfit.overBudgetBy !== null ? toNumber(outfit.overBudgetBy) : 0;
  const savings = outfit.savings !== null ? toNumber(outfit.savings) : 0;

  const detail = (piece: OutfitPiece) => {
    const source = sources.get(piece);
    return source ? (
      <PieceLabel
        piece={source}
        shippingNote={shippingNote(source)}
        signedIn={signedIn}
        onBuy={() => onBuy(source)}
        onAddSize={onAddSize}
      />
    ) : null;
  };

  return (
    <View style={styles.section} testID="budget-outfit">
      <View style={styles.head}>
        <View style={styles.total}>
          <Text style={styles.totalLabel}>{tr.budgetTotal}</Text>
          <Text style={styles.totalPrice} testID="budget-total">
            {formatTry(toNumber(outfit.totalPrice))}
          </Text>
        </View>
        <View style={styles.tags}>
          {outfit.withoutShoes ? (
            <Tag text={tr.budgetWithoutShoes} testID="budget-tag-without-shoes" />
          ) : null}
          {savings > 0 ? <Tag text={tr.budgetSavings(formatTry(savings))} chalk /> : null}
        </View>
      </View>

      {over > 0 ? (
        <View style={styles.over} testID="budget-over">
          <View style={styles.overRow}>
            <Icon name="info" size={18} color={theme.colors.danger} />
            <Text style={styles.overText}>{tr.budgetOver(formatTry(over))}</Text>
          </View>
          <Button
            label={tr.budgetIncrease}
            variant="quiet"
            onPress={onIncrease}
            testID="budget-over-increase"
          />
        </View>
      ) : (
        <Text style={styles.remaining} testID="budget-remaining">
          {tr.budgetRemaining(formatTry(toNumber(outfit.remainingBudget)))}
        </Text>
      )}

      <OutfitPieces pieces={figure} detail={detail} />
      <NarrationRow text={outfit.narration.text} />

      <View style={styles.actions}>
        <Button
          label={saving ? tr.saving : saved ? tr.outfitSaved : tr.outfitSave}
          variant="secondary"
          onPress={onSave}
          disabled={saved || saving}
          style={styles.save}
          testID="budget-save"
        />
        <Button
          label={tr.budgetDismiss}
          variant="quiet"
          onPress={onDismiss}
          testID="budget-dismiss"
        />
      </View>
    </View>
  );
}

interface PieceLabelProps {
  piece: BudgetPiece;
  /** "kargo dahil" under the price, when the contract says so (see `shipping.ts`); `null` draws nothing. */
  shippingNote?: string | null;
  signedIn: boolean;
  onBuy: () => void;
  onAddSize: () => void;
}

/** The label beside a well: an owned piece says so; a piece to buy shows its price and seller and is the buy link. */
export function PieceLabel({
  piece,
  shippingNote: note,
  signedIn,
  onBuy,
  onAddSize,
}: PieceLabelProps) {
  if (piece.source === 'Wardrobe') {
    return (
      <>
        <Text style={styles.name} numberOfLines={2}>
          {piece.name}
        </Text>
        <Text style={styles.owned}>{tr.outfitInWardrobe}</Text>
      </>
    );
  }
  const offer = piece.offer;
  const price = formatTry(toNumber(offer ? offer.price : piece.price));
  const seller = offer?.seller?.name ?? '';
  return (
    <>
      {offer ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.budgetBuyLabel(piece.name, seller, price)}
          onPress={onBuy}
          style={styles.buy}
          testID={`budget-buy-${piece.slot}`}
        >
          <Text style={styles.name} numberOfLines={2}>
            {piece.name}
          </Text>
          <Text style={styles.price}>{price}</Text>
          {note ? (
            <Text style={styles.sizeText} testID={`budget-shipping-${piece.slot}`}>
              {note}
            </Text>
          ) : null}
          <Text style={styles.seller}>
            {seller ? `${seller} · ` : ''}
            <Text style={styles.buyWord}>{tr.budgetBuy}</Text>
          </Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.name} numberOfLines={2}>
            {piece.name}
          </Text>
          <Text style={styles.price}>{price}</Text>
        </>
      )}
      {piece.size ? (
        <Text style={styles.sizeText} testID={`budget-size-${piece.slot}`}>
          {tr.budgetSize(piece.size)}
        </Text>
      ) : piece.sizeUnknown ? (
        signedIn ? (
          <Pressable
            accessibilityRole="link"
            onPress={onAddSize}
            hitSlop={theme.spacing.sm}
            style={styles.sizeLink}
            testID={`budget-size-add-${piece.slot}`}
          >
            <Text style={styles.sizeLinkText}>{tr.productSizeAdd}</Text>
          </Pressable>
        ) : (
          <Text style={styles.sizeText} testID={`budget-size-unknown-${piece.slot}`}>
            {tr.budgetSizeUnknown}
          </Text>
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  total: {
    gap: 2,
  },
  totalLabel: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  totalPrice: {
    ...theme.typography.priceLarge,
    color: theme.colors.ink,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
    flexShrink: 1,
  },
  tag: {
    borderRadius: theme.radius.tag,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  tagChalk: {
    backgroundColor: theme.colors.chalk,
  },
  tagText: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink2,
  },
  tagTextChalk: {
    color: theme.colors.chalkInk,
  },
  remaining: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  over: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  overRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexShrink: 1,
  },
  overText: {
    ...theme.typography.label,
    color: theme.colors.danger,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  save: {
    flex: 1,
  },
  name: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  owned: {
    ...theme.typography.captionStrong,
    color: theme.colors.primary,
  },
  buy: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
    gap: 2,
  },
  price: {
    ...theme.typography.price,
    color: theme.colors.ink,
  },
  seller: {
    ...theme.typography.caption,
    color: theme.colors.ink2,
  },
  buyWord: {
    ...theme.typography.captionStrong,
    color: theme.colors.primary,
  },
  sizeText: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  sizeLink: {
    alignSelf: 'flex-start',
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
  },
  sizeLinkText: {
    ...theme.typography.captionStrong,
    color: theme.colors.primary,
  },
});
