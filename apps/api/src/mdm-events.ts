/**
 * MDM Event Bus Contracts
 *
 * Defines event types for the Product-MDM microservice event bus.
 * Other services can subscribe to these events to synchronize data.
 */

// ── Event Types ─────────────────────────────────────────

export type MdmEventBase = {
    tenantId: string;
    timestamp: string; // ISO-8601
    source: string;    // "mdm-api" | "amazon-sync" | "walmart-sync"
};

export type ProductCreatedEvent = MdmEventBase & {
    type: 'product.created';
    payload: { productId: string; sku: string; brandId: string; categoryId: string };
};

export type ProductUpdatedEvent = MdmEventBase & {
    type: 'product.updated';
    payload: { productId: string; changedFields: string[] };
};

export type CommodityCreatedEvent = MdmEventBase & {
    type: 'commodity.created';
    payload: { commodityId: string; productId: string; marketId: string; language: string };
};

export type ListingCreatedEvent = MdmEventBase & {
    type: 'listing.created';
    payload: { listingId: string; commodityId: string | null; platformId: string; origin: string };
};

export type ListingMappedEvent = MdmEventBase & {
    type: 'listing.mapped';
    payload: { listingId: string; commodityId: string; mappedBy: string };
};

export type EntityMappingApprovedEvent = MdmEventBase & {
    type: 'entity.mapping.approved';
    payload: {
        mappingId: string;
        entityType: 'PRODUCT' | 'LISTING' | 'SUPPLIER' | 'WAREHOUSE';
        globalId: string;
        sourceSystem: string;
        externalId: string;
        externalSubId: string | null;
        approvedBy: string | null;
        approvedAt: string | null;
    };
};

export type EntityMappingRevokedEvent = MdmEventBase & {
    type: 'entity.mapping.revoked';
    payload: {
        mappingId: string;
        entityType: 'PRODUCT' | 'LISTING' | 'SUPPLIER' | 'WAREHOUSE';
        globalId: string;
        sourceSystem: string;
        externalId: string;
        externalSubId: string | null;
        revokedBy: string | null;
        revokedAt: string | null;
        reason: string | null;
        mode: 'MANUAL' | 'SOFT_REVOKE';
    };
};

export type EntityCostUpdatedEvent = MdmEventBase & {
    type: 'entity.cost.updated';
    payload: {
        costVersionId: string;
        productGlobalId: string;
        effectiveFrom: string;
        effectiveTo: string | null;
        sourceSystem: string | null;
    };
};

// Backward-compatibility event for legacy subscribers.
export type SkuMappedEvent = MdmEventBase & {
    type: 'sku-mapping.mapped';
    payload: { mappingId: string; productId: string; externalSku: string; sourceType: string };
};

export type PerformanceIngestedEvent = MdmEventBase & {
    type: 'performance.ingested';
    payload: { snapshotId: string; listingId: string; snapshotDate: string };
};

export type PlatformSyncEvent = MdmEventBase & {
    type: 'platform.sync-requested' | 'platform.sync-completed' | 'platform.sync-failed';
    payload: { platformId: string; error?: string };
};

export type MdmEvent =
    | ProductCreatedEvent
    | ProductUpdatedEvent
    | CommodityCreatedEvent
    | ListingCreatedEvent
    | ListingMappedEvent
    | EntityMappingApprovedEvent
    | EntityMappingRevokedEvent
    | EntityCostUpdatedEvent
    | SkuMappedEvent
    | PerformanceIngestedEvent
    | PlatformSyncEvent;

// ── Event Bus Helpers (stub) ────────────────────────────

const eventHandlers = new Map<string, ((event: MdmEvent) => Promise<void>)[]>();

export function onMdmEvent(type: MdmEvent['type'], handler: (event: MdmEvent) => Promise<void>) {
    const handlers = eventHandlers.get(type) ?? [];
    handlers.push(handler);
    eventHandlers.set(type, handlers);
}

export async function emitMdmEvent(event: MdmEvent) {
    const handlers = eventHandlers.get(event.type) ?? [];
    for (const handler of handlers) {
        try {
            await handler(event);
        } catch (err) {
            console.error(`[MDM Event Bus] Error handling ${event.type}:`, err);
        }
    }
}

// ── Master Data Isolation Handler Contract ──────────────

export interface MasterDataEventHandler {
    onMappingRevoked(event: EntityMappingRevokedEvent): Promise<void>;
    onCostUpdated(event: EntityCostUpdatedEvent): Promise<void>;
    onProductUpdated(event: ProductUpdatedEvent): Promise<void>;
}

export function registerMasterDataHandlers(handler: MasterDataEventHandler): void {
    onMdmEvent('entity.mapping.revoked', (e) => handler.onMappingRevoked(e as EntityMappingRevokedEvent));
    onMdmEvent('entity.cost.updated', (e) => handler.onCostUpdated(e as EntityCostUpdatedEvent));
    onMdmEvent('product.updated', (e) => handler.onProductUpdated(e as ProductUpdatedEvent));
}
