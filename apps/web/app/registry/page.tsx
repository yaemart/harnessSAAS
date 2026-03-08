'use client';

import { SystemRegistry } from '../../components/system-registry';
import { RoleGuard } from '../../components/guards/role-guard';

export default function RegistryPage() {
    return (
        <RoleGuard allowedRoles={['system_admin']}>
            <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{
                        fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em',
                        color: 'var(--text-primary)', margin: 0,
                    }}>
                        Global Registry
                        <span style={{
                            fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)',
                            marginLeft: 12, opacity: 0.6,
                        }}>
                            Layer A
                        </span>
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
                        Configure system-wide markets, platforms, categories, warehouses, ERP systems, and tools.
                        Tenants can only select from entities enabled here.
                    </p>
                </div>
                <SystemRegistry />
            </div>
        </RoleGuard>
    );
}
