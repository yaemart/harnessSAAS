import { Pool } from 'pg';

const adminPool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/ai_ecom',
});

const tenants = [
  { id: '11111111-1111-1111-1111-111111111111', code: 'tenant-1', name: 'Global Tech Corp (HQ)', plan: 'enterprise' },
  { id: '22222222-2222-2222-2222-222222222222', code: 'tenant-2', name: 'Alpha E-Commerce Solutions', plan: 'pro' },
  { id: '33333333-3333-3333-3333-333333333333', code: 'tenant-3', name: 'Beta Retail Ventures', plan: 'starter' },
];

for (const t of tenants) {
  await adminPool.query(
    `INSERT INTO "Tenant"(id, code, name, plan, "updatedAt")
     VALUES ($1, $2, $3, $4::\"TenantPlan\", now())
     ON CONFLICT (id) DO UPDATE SET plan = $4::\"TenantPlan\", "updatedAt" = now()`,
    [t.id, t.code, t.name, t.plan],
  );
  console.log(`[OK] ${t.name} → plan: ${t.plan}`);
}

console.log('Tenants seeded/updated with plans!');
await adminPool.end();
