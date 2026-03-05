'use client';

import { useSearchParams } from 'next/navigation';
import { ScreenWarranty } from '@/components/screen-warranty';

export default function WarrantyPage() {
  const searchParams = useSearchParams();
  const commodityId = searchParams.get('commodity') ?? undefined;
  return <ScreenWarranty commodityId={commodityId} />;
}
