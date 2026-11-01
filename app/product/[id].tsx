import { useLocalSearchParams } from 'expo-router';

import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';

export default function ProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductDetailScreen id={id} />;
}
