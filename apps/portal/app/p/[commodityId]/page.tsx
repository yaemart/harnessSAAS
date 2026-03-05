import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchCommodity, fetchFAQs, fetchMedia, fetchListings, UUID_RE } from '@/lib/api';
import { ProductDetail } from '@/components/product-detail';

interface PageProps {
  params: Promise<{ commodityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { commodityId } = await params;
  if (!UUID_RE.test(commodityId)) return { title: 'Product Not Found' };
  try {
    const commodity = await fetchCommodity(commodityId);
    return {
      title: `${commodity.product.name} — ${commodity.title}`,
      description: commodity.bulletPoints?.join(' ') ?? `Support for ${commodity.product.name}`,
    };
  } catch {
    return { title: 'Product Not Found' };
  }
}

export default async function CommodityPage({ params }: PageProps) {
  const { commodityId } = await params;

  if (!UUID_RE.test(commodityId)) {
    notFound();
    return;
  }

  let commodity;
  try {
    [commodity] = await Promise.all([
      fetchCommodity(commodityId),
    ]);
  } catch {
    notFound();
    return;
  }

  const [faqData, mediaData, listingsData] = await Promise.all([
    fetchFAQs(commodityId).catch(() => ({ faqs: [] as never[] })),
    fetchMedia(commodityId).catch(() => ({ media: [] as never[] })),
    fetchListings(commodityId).catch(() => ({ listings: [] as never[] })),
  ]);

  return (
    <ProductDetail
      commodity={commodity}
      faqs={faqData.faqs}
      media={mediaData.media}
      listings={listingsData.listings}
    />
  );
}
