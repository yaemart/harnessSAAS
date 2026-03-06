import { Pool } from 'pg';
import crypto from 'node:crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

async function main() {
  const client = await pool.connect();
  try {
    const tenantRes = await client.query(
      `INSERT INTO "Tenant" (id, name, code, status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'Global Tech Corp', 'globaltech', 'active', NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const tenantId = tenantRes.rows[0].id;
    console.log(`[seed] tenant: ${tenantId}`);

    const users = [
      { email: 'admin@system.io',     name: 'System Admin',  role: 'system_admin' },
      { email: 'boss@globaltech.com', name: 'Tenant Admin',  role: 'tenant_admin' },
      { email: 'ops@globaltech.com',  name: 'Operator',      role: 'operator' },
      { email: 'factory@supplier.cn', name: 'Supplier',      role: 'supplier' },
      { email: 'investor@vc.com',     name: 'Viewer',        role: 'viewer' },
    ];

    const password = 'harness123';

    for (const u of users) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(password, salt);

      await client.query(
        `INSERT INTO "User" (id, email, name, role, "tenantId", salt, hash, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [u.email, u.name, u.role, tenantId, salt, hash]
      );
      console.log(`[seed] upserted user: ${u.email} (${u.role})`);
    }

    console.log('[seed] done');
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => pool.end());
