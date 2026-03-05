const VALID_ENTITY_TYPES = ['listing', 'product', 'campaign'] as const;
export type EntityHashType = (typeof VALID_ENTITY_TYPES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidGlobalId(id: string): boolean {
    return UUID_RE.test(id);
}

export function buildEntityHash(entityType: EntityHashType, globalId: string): string {
    if (!globalId?.trim()) throw new Error('globalId must be a non-empty string');
    if (!isValidGlobalId(globalId)) {
        throw new Error(
            `globalId "${globalId}" is not a valid UUID. ` +
            `Do NOT use ASIN, SKU, ERP Code, or any non-UUID string as globalId. ` +
            `Use the internal Product.id or Listing.id instead.`,
        );
    }
    return `${entityType}:${globalId}`;
}

export function parseEntityHash(hash: string): { entityType: EntityHashType; globalId: string } | null {
    const colonIdx = hash.indexOf(':');
    if (colonIdx === -1) return null;
    const entityType = hash.slice(0, colonIdx) as EntityHashType;
    const globalId = hash.slice(colonIdx + 1);
    if (!VALID_ENTITY_TYPES.includes(entityType) || !globalId) return null;
    if (!isValidGlobalId(globalId)) return null;
    return { entityType, globalId };
}

export function assertEntityHash(hash: string): asserts hash is `${EntityHashType}:${string}` {
    if (!parseEntityHash(hash)) {
        throw new Error(
            `Invalid entityHash "${hash}". ` +
            `Must be format "{entityType}:{uuid}" where entityType is one of: ${VALID_ENTITY_TYPES.join(', ')} ` +
            `and uuid is a valid UUID v4. ` +
            `Do NOT use ASIN (e.g. B01NABCD123), SKU, or ERP Code as the globalId component.`,
        );
    }
}
