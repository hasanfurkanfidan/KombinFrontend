import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon, type IconName } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { addFromCatalog, addPhotos } from './addItem';
import { useCatalogSearch } from './hooks';
import { pickPhotos, takePhoto } from './picker';

/** The system camera/picker cannot be presented while this modal is still sliding away. */
const MODAL_DISMISS_MS = 350;
const SEARCH_DEBOUNCE_MS = 300;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface AddItemSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** "Parça ekle": camera, library or catalog. Photos go through the add flow and show up in the grid at once. */
export function AddItemSheet({ visible, onClose }: AddItemSheetProps) {
  const queryClient = useQueryClient();
  const [catalogOpen, setCatalogOpen] = useState(false);

  const fromCamera = async () => {
    onClose();
    await wait(MODAL_DISMISS_MS);
    const photos = await takePhoto();
    if (photos === 'denied') {
      showToast(tr.wardrobeCameraDenied);
    } else if (photos.length > 0) {
      void addPhotos(queryClient, photos, 'camera');
    }
  };

  const fromLibrary = async () => {
    onClose();
    await wait(MODAL_DISMISS_MS);
    const photos = await pickPhotos();
    if (photos.length > 0) {
      void addPhotos(queryClient, photos, 'library');
    }
  };

  return (
    <>
      <BottomSheet visible={visible} title={tr.wardrobeAddSheetTitle} onClose={onClose}>
        <Row
          icon="plus"
          label={tr.wardrobeAddCamera}
          onPress={() => void fromCamera()}
          id="camera"
        />
        <Row
          icon="wardrobe"
          label={tr.wardrobeAddLibrary}
          onPress={() => void fromLibrary()}
          id="library"
        />
        <Row
          icon="tag"
          label={tr.wardrobeAddCatalog}
          onPress={() => {
            onClose();
            setCatalogOpen(true);
          }}
          id="catalog"
        />
      </BottomSheet>
      <CatalogPickerSheet visible={catalogOpen} onClose={() => setCatalogOpen(false)} />
    </>
  );
}

function Row({
  icon,
  label,
  onPress,
  id,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  id: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.row}
      testID={`add-source-${id}`}
    >
      <Icon name={icon} size={22} />
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
}

/** Product search whose pick is posted to `/me/wardrobe/items/from-product`. */
function CatalogPickerSheet({ visible, onClose }: AddItemSheetProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const results = useCatalogSearch(query);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const pick = async (productId: string) => {
    setAdding(productId);
    try {
      await addFromCatalog(queryClient, productId);
      showToast(tr.wardrobeCatalogAdded);
      onClose();
    } catch {
      showToast(tr.wardrobeAddFailed);
    } finally {
      setAdding(null);
    }
  };

  return (
    <BottomSheet visible={visible} title={tr.wardrobeCatalogTitle} onClose={onClose}>
      <TextField
        label={tr.wardrobeCatalogSearch}
        value={text}
        onChangeText={setText}
        placeholder={tr.wardrobeCatalogSearch}
        autoCorrect={false}
        testID="catalog-search"
      />
      {results.data && results.data.length === 0 ? (
        <Text style={styles.empty}>{tr.wardrobeCatalogEmpty}</Text>
      ) : null}
      {(results.data ?? []).map((product) => (
        <Pressable
          key={product.id}
          accessibilityRole="button"
          disabled={adding !== null}
          onPress={() => void pick(product.id)}
          style={[styles.product, adding === product.id && styles.productBusy]}
          testID={`catalog-pick-${product.id}`}
        >
          <View style={styles.thumb}>
            {product.primaryImageUrl ? (
              <Image
                source={{ uri: product.primaryImageUrl }}
                style={styles.thumbImage}
                resizeMode="cover"
              />
            ) : (
              <Icon name="shirt" size={24} color={theme.colors.borderStrong} />
            )}
          </View>
          <View style={styles.productText}>
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand.name}
            </Text>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.price}>{formatTry(toNumber(product.lowestPrice))}</Text>
          </View>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  empty: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.sizes.thumbHeight,
  },
  productBusy: {
    opacity: 0.5,
  },
  thumb: {
    width: theme.sizes.thumbWidth,
    height: theme.sizes.thumbHeight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
  },
  productText: {
    flex: 1,
    gap: 2,
  },
  brand: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  productName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  price: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
});
