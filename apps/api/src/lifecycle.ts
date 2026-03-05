import type { PrismaClient } from '@prisma/client';

type ListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
type LifecycleStage = 'NEW' | 'GROWTH' | 'STABLE' | 'SUNSET';

function aggregateListingStatuses(statuses: ListingStatus[]): LifecycleStage {
  if (statuses.length === 0) return 'NEW';
  if (statuses.some((status) => status === 'ACTIVE')) return 'GROWTH';
  if (statuses.some((status) => status === 'PAUSED')) return 'STABLE';
  if (statuses.every((status) => status === 'ARCHIVED')) return 'SUNSET';
  return 'NEW';
}

function aggregateCommodityStages(stages: LifecycleStage[]): LifecycleStage {
  if (stages.length === 0) return 'NEW';
  if (stages.some((stage) => stage === 'GROWTH')) return 'GROWTH';
  if (stages.some((stage) => stage === 'STABLE')) return 'STABLE';
  if (stages.every((stage) => stage === 'SUNSET')) return 'SUNSET';
  return 'NEW';
}

export async function syncCommodityLifecycle(prisma: PrismaClient, commodityId: string): Promise<void> {
  const listings = await prisma.listing.findMany({
    where: { commodityId },
    select: { status: true },
  });

  const stage = aggregateListingStatuses(listings.map((listing) => listing.status as ListingStatus));
  await prisma.commodity.update({ where: { id: commodityId }, data: { lifecycleStage: stage } });
}

export async function syncProductLifecycle(prisma: PrismaClient, productId: string): Promise<void> {
  const commodities = await prisma.commodity.findMany({
    where: { productId },
    select: { lifecycleStage: true },
  });

  const stage = aggregateCommodityStages(
    commodities.map((commodity) => commodity.lifecycleStage as LifecycleStage),
  );
  await prisma.product.update({ where: { id: productId }, data: { lifecycleStage: stage } });
}

export async function syncLifecycleByListing(prisma: PrismaClient, listingId: string): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { commodity: { select: { id: true, productId: true } } },
  });

  if (!listing) {
    throw new Error(`Listing not found: ${listingId}`);
  }

  if (!listing.commodity) {
    // Unmapped listing — no commodity to sync
    return;
  }

  await syncCommodityLifecycle(prisma, listing.commodity.id);
  await syncProductLifecycle(prisma, listing.commodity.productId);
}

export async function syncLifecycleByCommodity(prisma: PrismaClient, commodityId: string): Promise<void> {
  const commodity = await prisma.commodity.findUnique({
    where: { id: commodityId },
    select: { id: true, productId: true },
  });

  if (!commodity) {
    throw new Error(`Commodity not found: ${commodityId}`);
  }

  await syncCommodityLifecycle(prisma, commodity.id);
  await syncProductLifecycle(prisma, commodity.productId);
}

export async function syncLifecycleByProduct(prisma: PrismaClient, productId: string): Promise<void> {
  await syncProductLifecycle(prisma, productId);
}
