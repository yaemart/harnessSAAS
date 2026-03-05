import { PrismaClient } from '../index.js';

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding a mock product...");

    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.log("No tenant found");
        return;
    }

    let market = await prisma.market.findFirst({ where: { tenantId: tenant.id } });
    if (!market) {
        market = await prisma.market.create({ data: { tenantId: tenant.id, code: 'US', name: 'United States', currency: 'USD' } });
    }

    let platform = await prisma.platform.findFirst({ where: { tenantId: tenant.id } });
    if (!platform) {
        platform = await prisma.platform.create({ data: { tenantId: tenant.id, code: 'AMZN', name: 'Amazon' } });
    }

    const product = await prisma.product.create({
        data: {
            tenantId: tenant.id,
            sku: 'PRD-MOCK-' + Date.now(),
            name: 'AeroPress Coffee Maker (Mock)',
            lifecycleStage: 'NEW',
            commodities: {
                create: [
                    {
                        tenantId: tenant.id,
                        marketId: market.id,
                        title: 'AeroPress Coffee Maker - US',
                        language: 'en',
                        lifecycleStage: 'LAUNCH',
                        listings: {
                            create: [
                                {
                                    tenantId: tenant.id,
                                    platformId: platform.id,
                                    title: 'AeroPress Original Coffee Press',
                                    externalListingId: 'B0018RY8H0',
                                    origin: 'PULL',
                                    mappingStatus: 'mapped',
                                    status: 'ACTIVE'
                                }
                            ]
                        }
                    }
                ]
            }
        }
    });

    console.log("Created mock product:", product.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
