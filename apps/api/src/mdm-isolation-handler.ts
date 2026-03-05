import type { PrismaClient } from '@prisma/client';
import type {
    MasterDataEventHandler,
    EntityMappingRevokedEvent,
    EntityCostUpdatedEvent,
    ProductUpdatedEvent,
} from './mdm-events.js';

export class MdmIsolationHandler implements MasterDataEventHandler {
    constructor(private readonly db: PrismaClient) {}

    async onMappingRevoked(event: EntityMappingRevokedEvent): Promise<void> {
        const { globalId, entityType, mappingId, reason } = event.payload;
        if (entityType !== 'PRODUCT') return;

        const db = this.db;
        await db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant_id', ${event.tenantId}, true)`;
            const client = tx as typeof db;

            await client.product.updateMany({
                where: { id: globalId, tenantId: event.tenantId },
                data: {
                    featureFrozen: true,
                    featureFrozenReason: 'mapping_revoked',
                },
            });

            await client.securityAuditEvent.create({
                data: {
                    tenantId: event.tenantId,
                    eventType: 'entity_frozen',
                    severity: 'HIGH',
                    details: {
                        trigger: 'mapping_revoked',
                        mappingId,
                        globalId,
                        reason: reason ?? null,
                        mode: event.payload.mode,
                    },
                },
            });
        });

        console.info(
            `[MdmIsolation] Product ${globalId} frozen due to mapping_revoked (mappingId=${mappingId})`,
        );
    }

    async onCostUpdated(event: EntityCostUpdatedEvent): Promise<void> {
        const { productGlobalId, costVersionId, effectiveFrom } = event.payload;
        const db = this.db;

        await db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant_id', ${event.tenantId}, true)`;
            const client = tx as typeof db;

            const updated = await client.productFeatureSnapshot.updateMany({
                where: {
                    tenantId: event.tenantId,
                    productGlobalId,
                    dataQualityScore: { gt: 0 },
                },
                data: { dataQualityScore: 0 },
            });

            await client.securityAuditEvent.create({
                data: {
                    tenantId: event.tenantId,
                    eventType: 'cost_version_changed',
                    severity: 'HIGH',
                    details: {
                        productGlobalId,
                        costVersionId,
                        effectiveFrom,
                        snapshotsInvalidated: updated.count,
                    },
                },
            });

            console.info(
                `[MdmIsolation] ${updated.count} feature snapshots invalidated for product ${productGlobalId} (new cost version ${costVersionId})`,
            );
        });
    }

    async onProductUpdated(event: ProductUpdatedEvent): Promise<void> {
        const { productId, changedFields } = event.payload;
        if (!changedFields.includes('asin')) return;

        const db = this.db;
        await db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant_id', ${event.tenantId}, true)`;
            const client = tx as typeof db;

            await client.product.updateMany({
                where: { id: productId, tenantId: event.tenantId },
                data: {
                    featureFrozen: true,
                    featureFrozenReason: 'asin_changed',
                },
            });

            await client.securityAuditEvent.create({
                data: {
                    tenantId: event.tenantId,
                    eventType: 'asin_merge_detected',
                    severity: 'HIGH',
                    details: {
                        productId,
                        changedFields,
                        note: 'Bandit weight reset required (Phase 2)',
                    },
                },
            });
        });

        console.info(
            `[MdmIsolation] Product ${productId} frozen due to asin_changed`,
        );
    }
}
