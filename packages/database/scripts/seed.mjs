import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import crypto from 'node:crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'globaltech' },
    update: {},
    create: {
      name: 'Global Tech Corp',
      slug: 'globaltech',
      plan: 'enterprise',
    },
  });

  const users = [
    { email: 'admin@system.io',     name: 'System Admin',  role: 'system_admin', tenantId: tenant.id },
    { email: 'boss@globaltech.com', name: 'Tenant Admin',  role: 'tenant_admin', tenantId: tenant.id },
    { email: 'ops@globaltech.com',  name: 'Operator',      role: 'operator',     tenantId: tenant.id },
    { email: 'factory@supplier.cn', name: 'Supplier',      role: 'supplier',     tenantId: tenant.id },
    { email: 'investor@vc.com',     name: 'Viewer',        role: 'viewer',       tenantId: tenant.id },
  ];

  const password = 'harness123';

  for (const u of users) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);

    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        tenantId: u.tenantId,
        salt,
        hash,
      },
    });

    console.log(`[seed] upserted user: ${u.email} (${u.role})`);
  }

  console.log('[seed] done');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
