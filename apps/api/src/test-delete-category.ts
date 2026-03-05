
import { prisma } from './db.js';

async function check() {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const id = 'da929344-c53b-4dd7-af73-40a3597fd71c'; // Electric Burr Grinders

    console.log(`Attempting to delete Category ${id} for tenant ${tenantId}`);

    const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return tx.category.deleteMany({ where: { id, tenantId } });
    });

    console.log('Result:', result);

    await prisma.$disconnect();
}

check().catch(console.error);
