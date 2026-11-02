import { useLocalSearchParams } from 'expo-router';

import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';
import { parseProductSource } from '@/features/catalog/productLink';

export default function ProductRoute() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  return <ProductDetailScreen id={id} source={parseProductSource(source)} />;
}
