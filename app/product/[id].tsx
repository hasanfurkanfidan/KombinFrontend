import { Redirect, useLocalSearchParams } from 'expo-router';

import { ProductDetailScreen } from '@/features/catalog/ProductDetailScreen';
import { parseProductSource } from '@/features/catalog/productLink';
import { uuidParam } from '@/utils/routeParams';

export default function ProductRoute() {
  const params = useLocalSearchParams<{ id: string; source?: string }>();
  const id = uuidParam(params.id);
  return id ? (
    <ProductDetailScreen id={id} source={parseProductSource(params.source)} />
  ) : (
    <Redirect href="/" />
  );
}
