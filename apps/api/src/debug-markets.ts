
import { prisma } from './db.js';

async function check() {
    const tenants = await prisma.tenant.findMany();
    console.log('--- Tenants ---');
    tenants.forEach(t => console.log(`${t.id}: ${t.name} (${t.code})`));

    const markets = await prisma.market.findMany({
        include: {
            _count: { select: { commodities: true } }
        }
    });

    console.log('\n--- Markets ---');
    markets.forEach(m => {
        console.log(`ID: ${m.id}, Code: ${m.code}, Tenant: ${m.tenantId}, Comms: ${m._count.commodities}`);
    });

    await prisma.$disconnect();
}

check().catch(console.error);
