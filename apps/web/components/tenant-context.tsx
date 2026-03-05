'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';

// Define the shape of a Workspace / Tenant
export interface Tenant {
    id: string;
    name: string;
    plan: 'ENTERPRISE' | 'PRO' | 'STARTER';
    region: string;
}

// Static catalog used for display labels.
const TENANT_CATALOG: Tenant[] = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Global Tech Corp (HQ)', plan: 'ENTERPRISE', region: 'us-east-1' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Alpha E-Commerce Solutions', plan: 'PRO', region: 'eu-west-1' },
    { id: '33333333-3333-3333-3333-333333333333', name: 'Beta Retail Ventures', plan: 'STARTER', region: 'ap-northeast-1' },
];

interface TenantContextType {
    currentTenantId: string;
    currentTenant: Tenant | undefined;
    tenants: Tenant[];
    switchTenant: (id: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [currentTenantId, setCurrentTenantId] = useState<string>(TENANT_CATALOG[0].id);
    const [isMounted, setIsMounted] = useState(false);

    const userTenant = useMemo<Tenant | null>(() => {
        if (!user) return null;
        const known = TENANT_CATALOG.find((t) => t.id === user.tenantId);
        if (known) return known;
        return {
            id: user.tenantId,
            name: 'Current Tenant',
            plan: 'PRO',
            region: 'us-east-1',
        };
    }, [user]);

    const tenants = useMemo<Tenant[]>(() => {
        if (!userTenant) return [TENANT_CATALOG[0]];
        if (user?.role === 'system_admin') {
            const map = new Map<string, Tenant>();
            for (const tenant of TENANT_CATALOG) map.set(tenant.id, tenant);
            map.set(userTenant.id, userTenant);
            return Array.from(map.values());
        }
        return [userTenant];
    }, [user, userTenant]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!userTenant) return;

        if (user?.role !== 'system_admin') {
            // Non system-admin users are always pinned to their JWT tenant.
            setCurrentTenantId(userTenant.id);
            localStorage.setItem('ai_os_tenant_id', userTenant.id);
            return;
        }

        const savedId = localStorage.getItem('ai_os_tenant_id');
        if (savedId && tenants.some((t) => t.id === savedId)) {
            setCurrentTenantId(savedId);
            return;
        }

        if (!tenants.some((t) => t.id === currentTenantId)) {
            setCurrentTenantId(userTenant.id);
            localStorage.setItem('ai_os_tenant_id', userTenant.id);
        }
    }, [user, userTenant, tenants, currentTenantId]);

    const switchTenant = (id: string) => {
        if (user?.role !== 'system_admin') return;
        if (!tenants.some((t) => t.id === id)) return;
        setCurrentTenantId(id);
        localStorage.setItem('ai_os_tenant_id', id);
    };

    const resolvedTenantId = isMounted ? currentTenantId : (tenants[0]?.id ?? TENANT_CATALOG[0].id);
    const currentTenant = tenants.find((t) => t.id === resolvedTenantId) ?? tenants[0] ?? TENANT_CATALOG[0];

    return (
        <TenantContext.Provider value={{
            currentTenantId: resolvedTenantId,
            currentTenant,
            tenants,
            switchTenant,
        }}>
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
}
