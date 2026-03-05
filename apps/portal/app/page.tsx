import { headers } from 'next/headers';
import { fetchProducts } from '@/lib/api';
import { HomeContent } from '@/components/home-content';

export default async function HomePage() {
  const h = await headers();
  const brandId = h.get('x-portal-brand-id') ?? '';
  const brandName = h.get('x-portal-brand-name') ?? 'Brand';
  const welcomeMessage = h.get('x-portal-welcome-message');

  let products: Awaited<ReturnType<typeof fetchProducts>>['products'] = [];
  if (brandId) {
    try {
      const data = await fetchProducts(brandId);
      products = data.products;
    } catch {
      // API unavailable — render with empty products
    }
  }

  return (
    <HomeContent
      brandName={brandName}
      welcomeMessage={welcomeMessage}
      products={products}
    />
  );
}
